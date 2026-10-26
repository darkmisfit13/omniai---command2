import type Stripe from "stripe";
import { computeRefundReversal } from "@/lib/billing/refundPolicy";
import {
  billingAdmin,
  planForPrice,
  grantCredits,
  syncSubscription,
} from "@/lib/billing/stripe";
import { stripeClient } from "@/lib/billing/stripe";
import { boosterPack } from "@/lib/billing/boosters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Stripe retries any 5xx for up to three days, so a slow handler is not a
// reason to exceed the platform's own ceiling and be killed mid-write.
export const maxDuration = 60;

/**
 * POST /api/stripe/webhook
 *
 * The only source of truth for whether somebody paid. Nothing else — not
 * checkout, not a client callback, not a dashboard glance — is allowed to
 * write a plan or grant credits, which is why this route runs on the service
 * role and verifies the signature before touching anything.
 *
 * Credits are granted on exactly one event, `invoice.paid`, rather than also
 * on `checkout.session.completed`. Both fire for a first purchase, and
 * granting in both places would need a second mechanism to stop the double.
 * One event, one path, deduped on the invoice id — a customer who refreshes
 * the confirmation page a hundred times still gets one grant.
 *
 * Refunds are handled via `charge.refunded`. Each Stripe refund (individual
 * refund ID) is processed exactly once. Partial refunds reverse a proportional
 * amount of credits. The original grant entry is never modified; reversals
 * are separate, auditable negative ledger entries.
 */

// ── helpers ──────────────────────────────────────────────────────────────

async function ownerIdForCustomer(
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  customerId: string
): Promise<string | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.owner_id ?? null;
}

function subscriptionOf(invoice: Stripe.Invoice): Stripe.Subscription | string | null {
  return invoice.parent?.subscription_details?.subscription ?? null;
}

function subscriptionOwnerId(invoice: Stripe.Invoice): string | null {
  return invoice.parent?.subscription_details?.metadata?.owner_id ?? null;
}

// ── invoice.paid ─────────────────────────────────────────────────────────

async function handleInvoicePaid(
  stripe: Stripe,
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  invoice: Stripe.Invoice
): Promise<void> {
  if (invoice.status !== "paid") return;

  const subscription = subscriptionOf(invoice);
  if (!subscription) return;

  const subId = typeof subscription === "string" ? subscription : subscription.id;
  if (!subId) return;

  const resolved =
    typeof subscription === "object" ? subscription : await stripe.subscriptions.retrieve(subId);

  const ownerId =
    subscriptionOwnerId(invoice) ?? resolved.metadata?.owner_id ??
    (invoice.customer ? await ownerIdForCustomer(admin, invoice.customer as string) : null);

  if (!ownerId) {
    throw new Error(`invoice.paid ${invoice.id} has no identifiable owner.`);
  }

  const priceId = resolved.items?.data?.[0]?.price?.id ?? null;
  const priceTier = resolved.items?.data?.[0]?.price?.metadata?.tier ?? null;

  const plan = await planForPrice(admin, priceId, priceTier);
  if (!plan) {
    throw new Error(
      `invoice.paid ${invoice.id} references price ${priceId ?? "(none)"}, which maps to no known plan.`
    );
  }

  await grantCredits(admin, {
    ownerId,
    amount: plan.monthlyCredits,
    tier: plan.tier,
    dedupeKey: `inv:${invoice.id}`,
    meta: {
      invoice: invoice.id,
      subscription: subId,
      priceId,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
    },
  });

  await syncSubscription(admin, {
    ownerId,
    customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
    subscriptionId: subId,
    priceId,
    tier: plan.tier,
    status: "active",
    periodEnd: resolved.items?.data?.[0]?.current_period_end ?? invoice.period_end,
  });
}

// ── subscription updated/deleted ─────────────────────────────────────────

async function handleSubscription(
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  subscription: Stripe.Subscription
): Promise<void> {
  const ownerId = subscription.metadata?.owner_id;
  if (!ownerId) return;

  const item = subscription.items?.data?.[0];
  const plan = await planForPrice(admin, item?.price?.id, item?.price?.metadata?.tier);

  await syncSubscription(admin, {
    ownerId,
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    subscriptionId: subscription.id,
    priceId: item?.price?.id ?? null,
    tier: plan?.tier ?? "free",
    status: subscription.status,
    periodEnd: item?.current_period_end ?? null,
  });
}

// ── booster purchase ─────────────────────────────────────────────────────

async function handleBoosterPurchase(
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  session: Stripe.Checkout.Session
): Promise<void> {
  const pack = boosterPack(session.metadata?.booster);
  if (!pack) return;

  if (session.payment_status !== "paid") return;

  const ownerId = session.metadata?.owner_id ?? session.client_reference_id ?? null;
  if (!ownerId) {
    throw new Error(`booster checkout ${session.id} has no identifiable owner.`);
  }

  await grantCredits(admin, {
    ownerId,
    amount: pack.credits,
    dedupeKey: `booster:${session.id}`,
    action: `booster:${pack.id}`,
    meta: {
      booster: pack.id,
      credits: pack.credits,
      amount_usd: pack.priceUsd,
      kind: "booster",
      checkoutSession: session.id,
      paymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    },
  });
}

// ── charge refunded ──────────────────────────────────────────────────────

/**
 * Reverse booster credit grants when a charge is refunded.
 *
 * Uses individual Stripe refund IDs for idempotency. Each refund is processed
 * exactly once. Partial refunds reverse a proportional amount of credits.
 * The original grant entry is never modified; reversals are separate,
 * auditable negative ledger entries.
 *
 * Only booster grants are reversed here. Subscription and generation charges
 * are out of scope.
 *
 * LIMITATION: The current ledger does not track which specific credits from a
 * purchase were consumed by which operation. The reversal is proportional
 * (refundedCents / originalChargeCents * originalGrantCredits), capped at
 * remaining credits. True per-purchase consumption tracking requires a schema
 * change (purchase_id on charge rows or a separate allocation table).
 */
async function handleChargeRefunded(
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntent =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!paymentIntent) return;

  // Find the original booster grant by payment intent.
  const { data: byIntent } = await admin
    .from("credit_ledger")
    .select("id, owner_id, delta, meta, dedupe_key")
    .eq("reason", "grant")
    .filter("meta->>paymentIntent", "eq", paymentIntent)
    .limit(1);

  let entries = byIntent ?? [];

  if (entries.length === 0) {
    // Grants created before paymentIntent was recorded in meta carry only
    // the checkout session id. Resolve the session from this payment intent
    // and retry, so replaying the refund of a pre-upgrade purchase finds its
    // grant instead of silently leaving the credits unreversed.
    try {
      const stripe = stripeClient();
      if (stripe) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntent,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          const { data: bySession } = await admin
            .from("credit_ledger")
            .select("id, owner_id, delta, meta, dedupe_key")
            .eq("reason", "grant")
            .eq("dedupe_key", `booster:${session.id}`)
            .limit(1);
          entries = bySession ?? [];
        }
      }
    } catch {
      // Resolution failure leaves the ledger untouched — safe default.
    }
  }

  if (entries.length === 0) {
    // Not a booster grant (subscription charge, generation hold, etc.) —
    // leave it to its own reversal flow.
    return;
  }

  const entry = entries[0];
  const ownerId = entry.owner_id;
  const originalAmount = Math.abs(entry.delta);
  if (originalAmount <= 0) return;

  // Collect all refunds on this charge. Fetch from Stripe if not fully populated.
  let refunds: Stripe.Refund[] = charge.refunds?.data ?? [];
  if (charge.refunds?.has_more) {
    try {
      const stripe = stripeClient();
      if (stripe) {
        const all = await stripe.refunds.list({ charge: charge.id, limit: 100 });
        refunds = all.data;
      }
    } catch {
      // Fall through with whatever we have.
    }
  }
  if (refunds.length === 0) {
    // No refund details — fall back to cumulative amount tracking.
    const dedupeKey = `refund:${charge.id}`;
    const { data: existing } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .limit(1);
    if (existing && existing.length > 0) return;

    const refundedAmount = charge.amount_refunded ?? 0;
    if (refundedAmount <= 0) return;

    const result = computeRefundReversal({
      originalGrantCredits: originalAmount,
      originalChargeCents: charge.amount > 0 ? charge.amount : 1,
      refundedCents: refundedAmount,
      alreadyReversedCredits: 0,
    });

    if (result.reversalCredits <= 0) return;

    await admin.from("credit_ledger").insert({
      owner_id: ownerId,
      delta: -result.reversalCredits,
      reason: "refund",
      action: `refund:${(entry.meta as { booster?: string })?.booster ?? "booster"}`,
      dedupe_key: dedupeKey,
      meta: {
        charge: charge.id,
        paymentIntent,
        refundId: null,
        originalEntry: entry.id,
        originalDedupeKey: entry.dedupe_key,
        reversalAmount: result.reversalCredits,
        refundedAmount,
        chargeAmount: charge.amount,
        reason: result.reason,
      },
    });
    return;
  }

  // Process each individual refund by its Stripe refund ID.
  const { data: existingReversals } = await admin
    .from("credit_ledger")
    .select("meta")
    .eq("reason", "refund")
    .filter("meta->>paymentIntent", "eq", paymentIntent);

  const processedRefundIds = new Set(
    (existingReversals ?? [])
      .map((r) => (r.meta as { refundId?: string | null })?.refundId)
      .filter((id): id is string => Boolean(id))
  );

  let totalAlreadyReversed = (existingReversals ?? []).reduce(
    (sum, r) => sum + Math.abs((r.meta as { reversalAmount?: number })?.reversalAmount ?? 0),
    0
  );

  const originalChargeCents = charge.amount > 0 ? charge.amount : 1;

  for (const refund of refunds) {
    if (processedRefundIds.has(refund.id)) continue;

    const refundedCents = refund.amount ?? 0;
    if (refundedCents <= 0) continue;

    const remainingCredits = originalAmount - totalAlreadyReversed;
    if (remainingCredits <= 0) break;

    const result = computeRefundReversal({
      originalGrantCredits: originalAmount,
      originalChargeCents,
      refundedCents,
      alreadyReversedCredits: totalAlreadyReversed,
    });

    if (result.reversalCredits <= 0) continue;

    const dedupeKey = `refund:${refund.id}`;
    const { data: existingDedupe } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .limit(1);
    if (existingDedupe && existingDedupe.length > 0) continue;

    await admin.from("credit_ledger").insert({
      owner_id: ownerId,
      delta: -result.reversalCredits,
      reason: "refund",
      action: `refund:${(entry.meta as { booster?: string })?.booster ?? "booster"}`,
      dedupe_key: dedupeKey,
      meta: {
        charge: charge.id,
        paymentIntent,
        refundId: refund.id,
        refundAmountCents: refundedCents,
        originalEntry: entry.id,
        originalDedupeKey: entry.dedupe_key,
        reversalAmount: result.reversalCredits,
        reason: result.reason,
      },
    });

    totalAlreadyReversed += result.reversalCredits;
  }
}

// ── POST handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const stripe = stripeClient();
  const admin = billingAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !admin) {
    return new Response(JSON.stringify({ error: "Billing is not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!secret) {
    return new Response(JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET is not set." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing signature");
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Invalid signature.",
        detail: error instanceof Error ? error.message : "unknown",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    switch (event.type) {
      case "invoice.paid": {
        await handleInvoicePaid(stripe, admin, event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const ownerId = customerId ? await ownerIdForCustomer(admin, customerId) : null;
        if (ownerId) {
          await admin
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("owner_id", ownerId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(admin, charge);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // A booster is a one-time payment and has no subscription behind it, so
        // it takes the additive path and is done. Everything else here is a
        // subscription whose credits are granted by invoice.paid — this branch
        // only warms the cached row so the first page load after paying is
        // already correct.
        if (session.mode === "payment" || session.metadata?.booster) {
          await handleBoosterPurchase(admin, session);
          break;
        }

        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subId) {
          const resolved = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(admin, resolved);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // 5xx makes Stripe retry. Anything else would drop the event, and an
    // event that grants credits must never be dropped on a transient failure.
    return new Response(
      JSON.stringify({
        error: "Handler failed.",
        detail: error instanceof Error ? error.message : "unknown",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}