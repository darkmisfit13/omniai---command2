import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";
import { PLANS } from "@/lib/billing/creditTable";
import {
  SETUP_HINT,
  billingAdmin,
  billingConfigGap,
  findOrCreateCustomer,
  planTier,
  siteBaseUrl,
  stripeClient,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout
 * Body: { tier: "creator" | "pro" | "business" }
 * Returns { url } — the Stripe-hosted page to redirect the browser to.
 *
 * This route deliberately writes nothing to the database. It runs on the
 * customer's JWT, and subscriptions is scoped to that same customer, so an
 * insert here would be a row the caller owns — which means a caller could
 * hand themselves a plan. Instead the identity travels in metadata and the
 * webhook, running with the service role, is what records the subscription
 * and grants the credits. Stripe said it happened, or it did not happen.
 */
export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const stripe = stripeClient();
  const admin = billingAdmin();
  if (!stripe || !admin) {
    return json({ error: SETUP_HINT, status: "billing_not_configured" }, 503);
  }

  const body = (await request.json().catch(() => null)) as { tier?: unknown } | null;
  const tier = planTier(body?.tier);
  if (!tier || tier === "free") {
    return json({ error: "tier must be creator, pro or business." }, 400);
  }

  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) return json({ error: "Unknown plan." }, 400);

  // Price ids live in the database so a wrong one can be corrected without a
  // deploy. Empty means the Stripe products have not been created yet, which
  // is a setup step — not a failure the customer should ever see.
  const { data: row } = await admin
    .from("plans")
    .select("stripe_price_id")
    .eq("tier", tier)
    .maybeSingle();

  const priceId = row?.stripe_price_id;
  if (!priceId) {
    return json(
      {
        error: `No Stripe price is configured for the ${plan.name} plan yet. Create the product and price in Stripe, then set plans.stripe_price_id for tier '${tier}'. ${SETUP_HINT}`,
        status: "price_not_configured",
        tier,
      },
      503
    );
  }

  const { data: userData, error: userError } = await session.client.auth.getUser(session.token);
  if (userError || !userData.user) {
    return json({ error: "Your sign-in expired. Sign in again." }, 401);
  }

  let customer;
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

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // The only place the plan is stated from the caller's side. The webhook
      // still decides, but this means a price id alone is enough to recover
      // which tier was actually bought.
      client_reference_id: session.userId,
      metadata: { owner_id: session.userId, tier },
      subscription_data: { metadata: { owner_id: session.userId, tier } },
      // Only if the account has Stripe Tax switched on: leaving this enabled
      // unconditionally makes session creation fail outright on an account
      // that has not registered for Tax, which would take checkout down for
      // an optional feature.
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
      billing_address_collection: "auto",
      success_url: `${base}/pricing?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
    });

    if (!checkout.url) {
      return json({ error: "Stripe did not return a checkout URL." }, 502);
    }

    return json({ url: checkout.url, tier, customerId: customer.id });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      502
    );
  }
}

/**
 * GET /api/stripe/checkout?tier=pro
 * Whether billing is switched on, and what the caller currently has.
 *
 * The pricing page needs this before it can decide to render a working button
 * or a setup notice, and it must not require Stripe to be configured just to
 * display the prices — those come from creditTable and are always shown.
 */
export async function GET(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const { missing } = billingConfigGap();
  const admin = billingAdmin();

  const { data: subscription } = admin
    ? await admin
        .from("subscriptions")
        .select("plan_tier, status, current_period_end")
        .eq("owner_id", session.userId)
        .maybeSingle()
    : { data: null };

  const { data: priceRows } = admin
    ? await admin.from("plans").select("tier, stripe_price_id")
    : { data: null };

  const priceByTier = new Map<string, string>();
  for (const row of priceRows ?? []) {
    if (row.stripe_price_id) priceByTier.set(row.tier, row.stripe_price_id);
  }

  return json({
    configured: missing.length === 0,
    missing,
    current: subscription ?? null,
    // Which tiers can actually be bought right now — the page disables the rest.
    available: PLANS.map((p) => ({
      tier: p.tier,
      priceUsd: p.priceUsd,
      monthlyCredits: p.monthlyCredits,
      ready: p.tier === "free" || priceByTier.has(p.tier),
    })),
  });
}
