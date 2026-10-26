import type Stripe from "stripe";
import {
  billingAdmin,
  planForPrice,
  grantCredits,
  syncSubscription,
} from "@/lib/billing/stripe";
import { stripeClient } from "@/lib/billing/stripe";

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
 * Shape notes for this pinned SDK version (2026-09-30.endive), which differ
 * from older Stripe docs and fail silently if assumed otherwise:
 *   - `invoice.subscription` is gone; the subscription now lives at
 *     `invoice.parent.subscription_details.subscription`.
 *   - `current_period_end` moved off Subscription onto SubscriptionItem.
 * The service period is therefore read from the invoice itself, which is
 * stable across both changes.
 */

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

async function handleInvoicePaid(
  stripe: Stripe,
  admin: NonNullable<ReturnType<typeof billingAdmin>>,
  invoice: Stripe.Invoice
): Promise<void> {
  // The boolean `invoice.paid` was removed in this API version in favour of a
  // status enum. Checking it was what stopped a $0 invoice — a trial converting
  // with no charge, or a fully-couponed period — from granting a month of
  // credits that were never paid for.
  if (invoice.status !== "paid") return;

  const subscription = subscriptionOf(invoice);
  if (!subscription) return;

  const subId = typeof subscription === "string" ? subscription : subscription.id;
  if (!subId) return;

  // Prefer the object already on the invoice; fetch only if Stripe sent the
  // bare id, so the common path costs no extra round trip.
  const resolved =
    typeof subscription === "object" ? subscription : await stripe.subscriptions.retrieve(subId);

  const ownerId =
    subscriptionOwnerId(invoice) ?? resolved.metadata?.owner_id ??
    (invoice.customer ? await ownerIdForCustomer(admin, invoice.customer as string) : null);

  if (!ownerId) {
    // Nothing identifies the payer, so granting would mean granting blind.
    // Fail loudly so the event is retried and surfaces in the Stripe dashboard
    // rather than quietly minting credits for nobody.
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
    // The invoice id is unique per billing cycle, so a replayed webhook and a
    // renewal in a later period are distinguishable without any clock logic.
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

  // The raw body is required. Parsing first would re-serialise it, and the
  // signature is an HMAC over the exact bytes Stripe sent.
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
          // Keep the plan: an expired card should not silently revoke work
          // already paid for. The status is what the UI turns into a prompt.
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
      case "checkout.session.completed": {
        // Credits are granted by invoice.paid. This only warms the cached row
        // so the customer's first page load after paying is already correct.
        const session = event.data.object as Stripe.Checkout.Session;
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
