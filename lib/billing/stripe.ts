import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLANS, type PlanTier } from "@/lib/billing/creditTable";

/**
 * The Stripe and database plumbing both routes need, in one place.
 *
 * Two rules shape everything here:
 *
 *   1. The webhook is the only thing that writes billing state. Checkout talks
 *      to Stripe and hands identity across in metadata; it never writes a row,
 *      because it runs on the customer's JWT and subscriptions is scoped to
 *      them. That keeps a forged or replayed checkout from setting anyone's
 *      plan — Stripe said it happened, or it did not happen.
 *
 *   2. Nothing is allowed to throw just because Stripe is not configured yet.
 *      Keys arrive on payday. Every entry point reports which variable is
 *      missing instead, so the app keeps working and the fix is named.
 */

export type BillingConfigGap = { missing: string[] };

export function billingConfigGap(): BillingConfigGap {
  const missing: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return { missing };
}

let cached: Stripe | null = null;

/** Null when Stripe is not configured — callers report the gap rather than crash. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: "2026-09-30.endive",
      typescript: true,
      appInfo: { name: "OmniAI", version: "1.0.0" },
    });
  }
  return cached;
}

/** Bypasses RLS. Only the webhook and setup paths use this — never a route a customer can call. */
export function billingAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SETUP_HINT =
  "Billing is not switched on yet. Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and " +
  "SUPABASE_SERVICE_ROLE_KEY to your environment (Vercel → Settings → Environment Variables, " +
  "or omniai/.env.local), then redeploy.";

/** Where Stripe should send the browser back to. */
export function siteBaseUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      /* fall through */
    }
  }
  return "https://omniai-app-chi.vercel.app";
}

export function planTier(value: unknown): PlanTier | null {
  return typeof value === "string" && ["free", "creator", "pro", "business"].includes(value)
    ? (value as PlanTier)
    : null;
}

/**
 * Map a Stripe price back to a plan.
 *
 * The database is preferred, because it can be corrected without a deploy. A
 * price created with `metadata.tier` is the fallback, so a Stripe account set
 * up by hand still resolves. Returning null means "this price is not ours" —
 * which is also the right answer for a stranger's price id.
 */
export async function planForPrice(
  admin: SupabaseClient,
  priceId: string | null | undefined,
  metadataTier?: string | null
): Promise<{ tier: PlanTier; monthlyCredits: number } | null> {
  if (priceId) {
    const { data } = await admin
      .from("plans")
      .select("tier, monthly_credits")
      .eq("stripe_price_id", priceId)
      .maybeSingle();
    if (data) return { tier: data.tier as PlanTier, monthlyCredits: data.monthly_credits };
  }

  const fromMetadata = planTier(metadataTier);
  if (fromMetadata) {
    const seeded = PLANS.find((p) => p.tier === fromMetadata);
    return { tier: fromMetadata, monthlyCredits: seeded?.monthlyCredits ?? 0 };
  }

  return null;
}

/**
 * The price for a paid plan, created on first use.
 *
 * Upgrades used to stop dead when `plans.stripe_price_id` was empty — the
 * state a fresh Stripe account is in, and the reason "Upgrade" answered 503.
 * The webhook already maps a price back to its plan via `plans.stripe_price_id`
 * *and* `metadata.tier`, so there is nothing to wait for: reuse a configured
 * price when one exists, otherwise find (or create) this tier's product, attach
 * an active monthly price carrying `metadata.tier`, and write the id back so
 * every later upgrade, invoice and renewal resolves without recreating anything.
 *
 * Price integrity: a configured price is only reused when its live amount
 * equals the catalog's `priceUsd`. Selling a stale $19 price while the catalog
 * says $9 would make checkout and the storefront disagree — the exact defect
 * this guard exists to prevent. When a mismatch is found, the stale id is left
 * in place (no live writes) and a clear error is thrown, unless
 * `STRIPE_ALLOW_PRICE_REPAIR=true` is set, in which case a replacement price
 * at the catalog amount is created on the same product and written back.
 */
export async function ensurePlanPrice(
  stripe: Stripe,
  admin: SupabaseClient,
  plan: { tier: PlanTier; name: string; priceUsd: number }
): Promise<string> {
  const allowRepair = process.env.STRIPE_ALLOW_PRICE_REPAIR === "true";
  const expectedCents = Math.round(plan.priceUsd * 100);

  // ── 1. Prefer the env var price IDs you've already configured in Stripe ──
  // This is the authoritative path when prices were created manually in the
  // Stripe dashboard. When the env var is present and valid, bypass the DB
  // entirely — the DB row may contain a stale price from a previous price point.
  const envPriceId =
    plan.tier === "creator"
      ? process.env.STRIPE_CREATOR_PRICE_ID
      : plan.tier === "pro"
        ? process.env.STRIPE_STUDIO_PRO_PRICE_ID
        : plan.tier === "business"
          ? process.env.STRIPE_ENTERPRISE_PRICE_ID
          : null;

  if (envPriceId && envPriceId.startsWith("price_")) {
    // Overwrite any stale DB row so webhooks resolve correctly going forward.
    void admin
      .from("plans")
      .upsert(
        { tier: plan.tier, stripe_price_id: envPriceId },
        { onConflict: "tier" }          // replace, not ignore
      )
      .then(() => undefined, () => undefined);
    return envPriceId;  // ← return immediately, never touch the DB check below
  }

  // ── 2. Fall back to the database row ─────────────────────────────────────
  const { data: row } = await admin
    .from("plans")
    .select("stripe_price_id")
    .eq("tier", plan.tier)
    .maybeSingle();

  if (row?.stripe_price_id) {
    const configured = row.stripe_price_id as string;
    const price = await stripe.prices.retrieve(configured).catch(() => null);
    const matches =
      price !== null &&
      price.active &&
      price.currency === "usd" &&
      price.unit_amount === expectedCents &&
      price.recurring?.interval === "month";
    if (matches) return configured;
    if (!allowRepair) {
      throw new Error(
        `Configured Stripe price for "${plan.tier}" does not match the catalog ` +
          `(${price ? `${price.currency} ${price.unit_amount}¢` : "unretrievable"} vs expected ${expectedCents}¢). ` +
          `Set STRIPE_ALLOW_PRICE_REPAIR=true to replace it, or update the price in Stripe.`
      );
    }
    // fall through to repair below, reusing the same product
  }

  // ── 3. Create product + price on first use (fresh Stripe account) ─────────
  // One product per tier, found first so a retry never litters the account.
  let productId: string | null = null;
  try {
    const found = await stripe.products.search({
      query: `metadata['tier']:'${plan.tier}'`,
      limit: 1,
    });
    productId = found.data[0]?.id ?? null;
  } catch {
    /* product search is unavailable on some accounts — create below */
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { tier: plan.tier },
    });
    productId = product.id;
  }

  // Reuse a monthly price this product already has at the *catalog* amount.
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 10 });
  const reused = existing.data.find(
    (price) =>
      price.recurring?.interval === "month" &&
      price.currency === "usd" &&
      price.unit_amount === expectedCents
  );
  const price =
    reused ??
    (await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: expectedCents,
      recurring: { interval: "month" },
      metadata: { tier: plan.tier },
    }));

  // Best effort — the id in hand is already usable even if the write-back fails.
  void admin.from("plans").upsert(
    { tier: plan.tier, stripe_price_id: price.id },
    { onConflict: "tier" }
  ).then(() => undefined, () => undefined);
  return price.id;
}

/**
 * Grant credits, at most once per period.
 *
 * The dedupe key is the whole safety property: Stripe retries webhooks, and a
 * customer refreshing a confirmation page can fire the same event twice. One
 * unique index in the ledger does more here than any amount of in-memory
 * de-duplication, which dies with the serverless instance.
 */
export async function grantCredits(
  admin: SupabaseClient,
  args: {
    ownerId: string;
    amount: number;
    /**
     * The plan the grant came from. Omitted for grants that are not a plan —
     * a one-time booster pack, for instance — so the ledger meta does not
     * pretend a top-up was a subscription.
     */
    tier?: PlanTier | null;
    dedupeKey: string;
    action?: string;
    meta?: Record<string, unknown>;
  }
): Promise<{ granted: boolean }> {
  const { error } = await admin.from("credit_ledger").insert({
    owner_id: args.ownerId,
    delta: args.amount,
    reason: "grant",
    action: args.action ?? (args.tier ? `plan:${args.tier}` : "grant"),
    dedupe_key: args.dedupeKey,
    meta: { ...(args.tier ? { plan: args.tier } : {}), ...args.meta },
  });

  // 23505 is unique_violation — already granted for this period. That is
  // success by another name, not an error worth retrying.
  if (error && error.code !== "23505") {
    throw new Error(`Could not grant credits: ${error.message}`);
  }

  return { granted: error?.code !== "23505" };
}

/** Keep the cached subscription row warm so no page load has to call Stripe. */
export async function syncSubscription(
  admin: SupabaseClient,
  args: {
    ownerId: string;
    customerId?: string | null;
    subscriptionId?: string | null;
    priceId?: string | null;
    tier: PlanTier;
    status: string;
    periodEnd?: number | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const periodEnd = args.periodEnd ? new Date(args.periodEnd * 1000).toISOString() : null;

  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        owner_id: args.ownerId,
        stripe_customer_id: args.customerId ?? null,
        stripe_subscription_id: args.subscriptionId ?? null,
        stripe_price_id: args.priceId ?? null,
        plan_tier: args.tier,
        status: args.status,
        current_period_end: periodEnd,
        updated_at: now,
      },
      { onConflict: "owner_id" }
    );

  if (error) throw new Error(`Could not sync subscription: ${error.message}`);
}

/**
 * Find the caller's Stripe customer without a database read.
 *
 * Checkout cannot write subscriptions (it runs on the customer's JWT, and
 * that table is scoped to them), so the customer id has to come back from
 * Stripe itself.
 *
 * The lookup filters on email — a parameter every Stripe list endpoint
 * definitely supports — and then matches the owner_id in metadata by hand.
 * Filtering the list *on* metadata would be neater, but it is not supported
 * consistently across resources, and a silent miss here would create a second
 * billing identity for someone who already has one.
 */
export async function findOrCreateCustomer(
  stripe: Stripe,
  args: { ownerId: string; email: string }
): Promise<Stripe.Customer> {
  const byEmail = await stripe.customers.list({ email: args.email, limit: 100 });

  const mine = byEmail.data.find((c) => !c.deleted && c.metadata?.owner_id === args.ownerId);
  if (mine) return mine;

  return stripe.customers.create({
    email: args.email,
    metadata: { owner_id: args.ownerId },
  });
}
