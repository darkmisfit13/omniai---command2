import type Stripe from "stripe";
import {
  authorizeUser,
  isUserSession,
  json,
  type UserSession,
} from "@/lib/generation/serverAuth";
import { PLANS, type PlanTier } from "@/lib/billing/creditTable";
import {
  BOOSTER_PACKS,
  boosterPack,
  boosterPriceId,
  type BoosterPack,
} from "@/lib/billing/boosters";
import {
  SETUP_HINT,
  billingAdmin,
  billingConfigGap,
  ensurePlanPrice,
  findOrCreateCustomer,
  planTier,
  siteBaseUrl,
  stripeClient,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/billing/upgrade — the Billing Hub's single serverless door.
 *
 * Two jobs live here, and both end the same way: this route never writes a
 * plan or a credit itself. It talks to Stripe and lets the webhook — the only
 * thing that has ever been allowed to move money into state — record the
 * result. That is what keeps a forged request from handing somebody a plan.
 *
 *   POST { tier }   plan change. If the caller already has a live Stripe
 *                   subscription the change is applied to it in place with
 *                   proration, so the account upgrades *now* instead of being
 *                   double-billed by a second subscription. Otherwise a
 *                   Checkout Session is opened. Either way the caller's
 *                   existing rows — projects, assets, ledger — are untouched;
 *                   credits are only ever added, never reset.
 *   POST { pack }   one-time Credit Booster Pack. A payment-mode Checkout
 *                   Session; the webhook grants the credits once, deduped on
 *                   the session id.
 *
 *   GET             the snapshot the Billing Hub renders: current tier, renewal
 *                   date, live balance, which tiers are purchasable, and the
 *                   booster shelf.
 */

type SubscriptionRow = {
  plan_tier: string;
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
};

/** Stripe statuses that mean "there is a live subscription to modify". */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function hasLiveSubscription(row: SubscriptionRow | null): boolean {
  return Boolean(
    row?.stripe_subscription_id && LIVE_STATUSES.has((row.status ?? "").toLowerCase())
  );
}

/**
 * Reuse an already-open Checkout Session for the same customer and product.
 *
 * Repeated clicks, a re-rendered page, or a user navigating back and pressing
 * "buy" again must not mint a second Checkout Session — for a subscription
 * that is a second billing relationship waiting to happen. Stripe keeps open
 * sessions for 24 hours; if one already matches this customer and product, its
 * hosted URL is returned instead of creating another. Stripe list endpoints do
 * not filter on metadata, so the match is applied to the returned page.
 */
async function findOpenSessionUrl(
  stripe: Stripe,
  customerId: string,
  match: (session: Stripe.Checkout.Session) => boolean
): Promise<string | null> {
  try {
    const open = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "open",
      limit: 20,
    });
    const now = Math.floor(Date.now() / 1000);
    const hit = open.data.find(
      (session) =>
        typeof session.url === "string" &&
        session.url.length > 0 &&
        typeof session.expires_at === "number" &&
        session.expires_at > now &&
        match(session)
    );
    return hit?.url ?? null;
  } catch {
    // A lookup failure must never block a legitimate checkout — fall through
    // and create a fresh session below.
    return null;
  }
}

export async function GET(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const { missing } = billingConfigGap();
  const admin = billingAdmin();

  // Reads run on the caller's own JWT. RLS already scopes subscriptions and
  // credit_ledger to auth.uid(), so this cannot leak another account's state.
  const { data: subscriptionData } = await session.client
    .from("subscriptions")
    .select("plan_tier, status, current_period_end, stripe_subscription_id")
    .eq("owner_id", session.userId)
    .maybeSingle();
  const subscription = (subscriptionData as SubscriptionRow | null) ?? null;

  const { data: balanceData } = await session.client.rpc("omni_credit_balance");
  const balance = typeof balanceData === "number" ? balanceData : null;

  let pendingChange: { tier: string; from: string; effectiveAt: string | null } | null = null;
  const stripe = stripeClient();
  if (stripe && hasLiveSubscription(subscription) && subscription?.stripe_subscription_id) {
    try {
      const liveSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const attachedSchedule = (liveSubscription as unknown as {
        schedule?: string | { id: string } | null;
      }).schedule;
      const scheduleId =
        typeof attachedSchedule === "string" ? attachedSchedule : attachedSchedule?.id;
      if (scheduleId) {
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
        const currentPhaseEnd = schedule.current_phase?.end_date;
        const nextPhase = schedule.phases.find(
          (phase) =>
            typeof phase.start_date === "number" &&
            typeof currentPhaseEnd === "number" &&
            phase.start_date >= currentPhaseEnd &&
            typeof phase.metadata?.tier === "string"
        );
        const nextTier = nextPhase?.metadata?.tier;
        if (nextTier && nextTier !== subscription.plan_tier) {
          const effectiveAt =
            typeof nextPhase.start_date === "number"
              ? new Date(nextPhase.start_date * 1000).toISOString()
              : null;
          pendingChange = { tier: nextTier, from: subscription.plan_tier, effectiveAt };
        }
      }
    } catch {
      // A schedule lookup is only display metadata; it must not hide billing.
    }
  }

  const { data: priceRows } = admin
    ? await admin.from("plans").select("tier, stripe_price_id")
    : { data: null };

  const priceByTier = new Map<string, string>();
  for (const row of priceRows ?? []) {
    if (row.stripe_price_id) priceByTier.set(row.tier, row.stripe_price_id as string);
  }

  return json({
    configured: missing.length === 0,
    missing,
    current: subscription ?? null,
    balance,
    hasLiveSubscription: hasLiveSubscription(subscription ?? null),
    pendingChange,
    plans: PLANS.map((plan) => ({
      tier: plan.tier,
      name: plan.name,
      priceUsd: plan.priceUsd,
      monthlyCredits: plan.monthlyCredits,
      blurb: plan.blurb,
      highlights: plan.highlights,
      ready: plan.tier === "free" || priceByTier.has(plan.tier) || missing.length === 0,
    })),
    boosters: BOOSTER_PACKS,
  });
}

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const stripe = stripeClient();
  const admin = billingAdmin();
  if (!stripe || !admin) {
    return json({ error: SETUP_HINT, status: "billing_not_configured" }, 503);
  }

  const body = (await request.json().catch(() => null)) as
    | { tier?: unknown; pack?: unknown; kind?: unknown }
    | null;

  const pack = boosterPack(body?.pack);
  if (pack) return purchaseBooster(request, stripe, session, pack);

  const tier = planTier(body?.tier);
  if (tier && tier !== "free") return upgradePlan(request, stripe, admin, session, tier);

  return json({ error: "Provide a plan tier or a booster pack id." }, 400);
}

/* ------------------------------------------------------------------ */
/* Plan upgrade                                                        */
/* ------------------------------------------------------------------ */

async function upgradePlan(
  request: Request,
  stripe: Stripe,
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  session: UserSession,
  tier: PlanTier
) {
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) return json({ error: "Unknown plan." }, 400);

  // A fresh Stripe account has no prices yet — create (or find) the tier's
  // price on first upgrade instead of refusing with 503. ensurePlanPrice writes
  // the id back to plans and tags it metadata.tier so the webhook can map it.
  let priceId: string;
  try {
    priceId = await ensurePlanPrice(stripe, admin, plan);
  } catch (error) {
    return json(
      {
        error: `Could not prepare the ${plan.name} plan in Stripe: ${
          error instanceof Error ? error.message : "unknown error"
        } ${SETUP_HINT}`,
        status: "price_not_configured",
        tier,
      },
      502
    );
  }

  const { data: currentData } = await admin
    .from("subscriptions")
    .select("plan_tier, status, stripe_subscription_id")
    .eq("owner_id", session.userId)
    .maybeSingle();
  const current = (currentData as SubscriptionRow | null) ?? null;

  // Existing subscriber → change the subscription in place. This is the exact
  // reason a second Checkout Session is wrong here: it would open a second
  // subscription and bill the card twice. Prorating and modifying keeps one
  // billing relationship and grants the new tier's credits additively.
  if (hasLiveSubscription(current) && current?.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(current.stripe_subscription_id);
      const item = subscription.items.data[0];
      if (!item) {
        return json({ error: "This subscription has no billable item to change." }, 409);
      }

      const rank: Record<string, number> = { free: 0, creator: 1, pro: 2, business: 3 };
      if ((rank[tier] ?? 0) === (rank[current.plan_tier] ?? 0)) {
        const attachedSchedule = (subscription as unknown as {
          schedule?: string | { id: string } | null;
        }).schedule;
        const scheduleId =
          typeof attachedSchedule === "string" ? attachedSchedule : attachedSchedule?.id ?? null;
        if (scheduleId) {
          await stripe.subscriptionSchedules.release(scheduleId);
          return json({
            updated: true,
            tier,
            name: plan.name,
            status: "change_cancelled",
            message: "The scheduled plan change was cancelled. Your current plan remains active.",
          });
        }
        return json(
          { error: "You are already on this plan.", status: "no_change" },
          409
        );
      }

      // Every plan change is queued for the next renewal. Keeping the existing
      // price in phase one preserves current access, and no proration is charged
      // today. Selecting another tier replaces any previously scheduled phase.
      try {
        const attachedSchedule = (subscription as unknown as {
          schedule?: string | { id: string } | null;
        }).schedule;
        let scheduleId: string | null =
          typeof attachedSchedule === "string" ? attachedSchedule : attachedSchedule?.id ?? null;

        if (!scheduleId) {
          const schedule = await stripe.subscriptionSchedules.create({
            from_subscription: subscription.id,
          });
          scheduleId = schedule.id;
        }

        const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;
        const currentPeriodStart = (subscription as unknown as { current_period_start: number }).current_period_start;
        const currentPriceId =
          typeof item.price === "string" ? item.price : (item.price as { id: string }).id;

        await stripe.subscriptionSchedules.update(scheduleId, {
          end_behavior: "release",
          phases: [
            {
              items: [{ price: currentPriceId, quantity: 1 }],
              start_date: currentPeriodStart,
              end_date: currentPeriodEnd,
              proration_behavior: "none",
              metadata: { owner_id: session.userId, tier: current.plan_tier },
            },
            {
              items: [{ price: priceId, quantity: 1 }],
              proration_behavior: "none",
              metadata: { owner_id: session.userId, tier, plan_change_from: current.plan_tier },
            },
          ],
        });

        return json({
          updated: true,
          tier,
          name: plan.name,
          status: "change_scheduled",
          message: plan.name + " will activate at your next billing cycle. Your current plan and credits stay in place until then.",
        });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Could not schedule the plan change." },
          502
        );
      }
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Could not change the subscription." },
        502
      );
    }
  }

  return openSubscriptionCheckout(request, stripe, session, tier, priceId);
}

async function openSubscriptionCheckout(
  request: Request,
  stripe: Stripe,
  session: UserSession,
  tier: PlanTier,
  priceId: string
) {
  const { data: userData, error: userError } = await session.client.auth.getUser(session.token);
  if (userError || !userData.user) {
    return json({ error: "Your sign-in expired. Sign in again." }, 401);
  }

  let customer: Stripe.Customer;
  try {
    customer = await findOrCreateCustomer(stripe, {
      ownerId: session.userId,
      email: userData.user.email ?? "",
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not create a Stripe customer." },
      502
    );
  }

  const base = siteBaseUrl(request);

  // Guard against double-clicks and back-button retries creating a second
  // subscription at Checkout: reuse the open session if one already exists.
  const reused = await findOpenSessionUrl(
    stripe,
    customer.id,
    (session) => session.mode === "subscription" && session.metadata?.tier === tier
  );
  if (reused) return json({ url: reused, tier, customerId: customer.id, reused: true });

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: session.userId,
      metadata: { owner_id: session.userId, tier },
      subscription_data: { metadata: { owner_id: session.userId, tier } },
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
      billing_address_collection: "auto",
      success_url: `${base}/settings/billing?checkout=success&tier=${tier}`,
      cancel_url: `${base}/settings/billing?checkout=cancelled`,
    });

    if (!checkout.url) return json({ error: "Stripe did not return a checkout URL." }, 502);
    return json({ url: checkout.url, tier, customerId: customer.id });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      502
    );
  }
}

/* ------------------------------------------------------------------ */
/* Credit Booster Pack                                                 */
/* ------------------------------------------------------------------ */

async function purchaseBooster(
  request: Request,
  stripe: Stripe,
  session: UserSession,
  pack: BoosterPack
) {
  const { data: userData, error: userError } = await session.client.auth.getUser(session.token);
  if (userError || !userData.user) {
    return json({ error: "Your sign-in expired. Sign in again." }, 401);
  }

  let customer: Stripe.Customer;
  try {
    customer = await findOrCreateCustomer(stripe, {
      ownerId: session.userId,
      email: userData.user.email ?? "",
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not create a Stripe customer." },
      502
    );
  }

  const base = siteBaseUrl(request);

  // Same duplicate protection as subscriptions: an open one-time session for
  // this exact pack is reused rather than a second one being created.
  const reused = await findOpenSessionUrl(
    stripe,
    customer.id,
    (session) => session.mode === "payment" && session.metadata?.booster === pack.id
  );
  if (reused) return json({ url: reused, pack: pack.id, credits: pack.credits, reused: true });

  // Prefer a real Stripe Price when one is configured (nicer reporting);
  // otherwise fall back to inline price data so no product setup is required.
  const configuredPrice = boosterPriceId(pack.id);

  // Server-authoritative inline price data. The price and credit amount come
  // from the pack definition, never from the client.
  const inlineLineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: pack.priceUsd * 100,
      product_data: {
        name: `${pack.name} — ${pack.credits.toLocaleString()} credits`,
        description: pack.blurb,
        metadata: { booster: pack.id },
      },
    },
  };

  const primaryLineItem: Stripe.Checkout.SessionCreateParams.LineItem = configuredPrice
    ? { price: configuredPrice, quantity: 1 }
    : inlineLineItem;

  // Safe diagnostic logging: pack id, whether a configured price is present,
  // Stripe error type/code, HTTP status, and request ID. Never log secrets,
  // customer info, checkout URLs, or full Price IDs.
  function logCheckoutFailure(stage: string, error: unknown) {
    const e = error as { type?: string; code?: string; statusCode?: number; requestId?: string } | null;
    console.error("[billing] booster checkout failed", {
      stage,
      pack: pack.id,
      configuredPricePresent: Boolean(configuredPrice),
      errorType: e?.type ?? (error instanceof Error ? "Error" : "unknown"),
      errorCode: e?.code ?? null,
      httpStatus: e?.statusCode ?? null,
      requestId: e?.requestId ?? null,
    });
  }

  // Only fall back to inline price_data when a configured Price ID is clearly
  // missing/invalid. Never fall back for permission, rate-limit, card, network,
  // or unknown errors — those must surface to the caller.
  function isMissingPriceError(error: unknown): boolean {
    const e = error as { type?: string; code?: string; message?: string } | null;
    if (!e) return false;
    if (e.code === "resource_missing") return true;
    if (e.type === "StripeInvalidRequestError" && typeof e.message === "string") {
      const msg = e.message.toLowerCase();
      return msg.includes("no such price") || msg.includes("no such product");
    }
    return false;
  }

  async function createCheckout(
    lineItem: Stripe.Checkout.SessionCreateParams.LineItem
  ): Promise<Stripe.Checkout.Session> {
    return stripe.checkout.sessions.create({
      mode: "payment",
      customer: customer.id,
      line_items: [lineItem],
      allow_promotion_codes: true,
      client_reference_id: session.userId,
      metadata: { owner_id: session.userId, booster: pack.id },
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
      billing_address_collection: "auto",
      success_url: `${base}/settings/billing?booster=success`,
      cancel_url: `${base}/settings/billing?booster=cancelled`,
    });
  }

  try {
    const checkout = await createCheckout(primaryLineItem);
    if (!checkout.url) return json({ error: "Stripe did not return a checkout URL." }, 502);
    return json({ url: checkout.url, pack: pack.id, credits: pack.credits });
  } catch (error) {
    logCheckoutFailure("primary", error);

    // Fall back to inline price_data only when a configured price was used and
    // the error clearly indicates it is missing/invalid.
    if (configuredPrice && isMissingPriceError(error)) {
      try {
        const checkout = await createCheckout(inlineLineItem);
        if (!checkout.url) return json({ error: "Stripe did not return a checkout URL." }, 502);
        return json({ url: checkout.url, pack: pack.id, credits: pack.credits });
      } catch (retryError) {
        logCheckoutFailure("inline-fallback", retryError);
        return json(
          { error: retryError instanceof Error ? retryError.message : "Could not start checkout." },
          502
        );
      }
    }

    return json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      502
    );
  }
}
