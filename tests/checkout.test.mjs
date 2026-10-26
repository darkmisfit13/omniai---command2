import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  intentBody,
  intentPath,
  intentQuery,
  parseIntent,
  safeNextPath,
} from "../lib/billing/purchaseIntent.ts";
import { PLANS } from "../lib/billing/creditTable.ts";
import { BOOSTER_PACKS } from "../lib/billing/boosters.ts";

/**
 * Checkout wiring — the path from a visible button to a validated server
 * product selection.
 *
 * The pure intent helpers are exercised directly. The route/component wiring
 * is pinned by reading the source, because the alternative (a live Stripe
 * Checkout Session) is a live mutation that must not run in a test suite.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

const CATALOG = {
  tiers: PLANS.filter((plan) => plan.priceUsd > 0).map((plan) => plan.tier),
  packs: BOOSTER_PACKS.map((pack) => pack.id),
};

function params(entries) {
  const map = new Map(Object.entries(entries));
  return (key) => map.get(key) ?? null;
}

// ── Intent round-trip ─────────────────────────────────────────────────────

test("the purchasable tier set is exactly the paid plans", () => {
  assert.deepEqual(CATALOG.tiers, ["creator", "pro", "business"]);
});

test("every paid plan round-trips through a purchase intent", () => {
  for (const tier of CATALOG.tiers) {
    const intent = { kind: "plan", tier };
    const query = intentQuery(intent);
    assert.equal(query, `buy=${tier}`);
    assert.equal(intentPath(intent), `/pricing?buy=${tier}`);
    const key = query.split("=")[0];
    const value = query.split("=")[1];
    assert.deepEqual(parseIntent(params({ [key]: value }), CATALOG), intent);
    assert.deepEqual(intentBody(intent), { tier });
  }
});

test("every booster pack round-trips through a purchase intent", () => {
  for (const id of CATALOG.packs) {
    const intent = { kind: "pack", id };
    const query = intentQuery(intent);
    assert.equal(query, `pack=${id}`);
    assert.equal(intentPath(intent), `/pricing?pack=${id}`);
    assert.deepEqual(parseIntent(params({ pack: id }), CATALOG), intent);
    assert.deepEqual(intentBody(intent), { pack: id });
  }
});

test("unknown, free, or malformed intents are rejected", () => {
  assert.equal(parseIntent(params({ buy: "free" }), CATALOG), null);
  assert.equal(parseIntent(params({ buy: "ultra" }), CATALOG), null);
  assert.equal(parseIntent(params({ buy: "" }), CATALOG), null);
  assert.equal(parseIntent(params({ pack: "spark-9999" }), CATALOG), null);
  assert.equal(parseIntent(params({}), CATALOG), null);
});

test("a valid plan intent is still found when an unknown pack is present", () => {
  assert.deepEqual(parseIntent(params({ pack: "nope", buy: "pro" }), CATALOG), {
    kind: "plan",
    tier: "pro",
  });
});

// ── Open-redirect defence ─────────────────────────────────────────────────

test("safeNextPath only allows same-origin absolute paths", () => {
  assert.equal(safeNextPath("/pricing?buy=creator"), "/pricing?buy=creator");
  assert.equal(safeNextPath("/settings/billing"), "/settings/billing");
  assert.equal(safeNextPath(undefined), "/dashboard");
  assert.equal(safeNextPath(""), "/dashboard");
  assert.equal(safeNextPath("https://evil.example"), "/dashboard");
  assert.equal(safeNextPath("//evil.example"), "/dashboard");
  assert.equal(safeNextPath("/\\evil.example"), "/dashboard");
  assert.equal(safeNextPath("pricing"), "/dashboard");
});

// ── Server product modes ──────────────────────────────────────────────────

test("subscription checkout is recurring and one-time checkout is payment mode", () => {
  const upgrade = read("app/api/billing/upgrade/route.ts");
  assert.ok(upgrade.includes('mode: "subscription"'), "plans must use subscription mode");
  assert.ok(upgrade.includes('mode: "payment"'), "boosters must use payment mode");
  assert.ok(
    upgrade.includes("subscription_data: { metadata: { owner_id: session.userId, tier } }"),
    "a subscription must carry the tier on the subscription for the webhook",
  );
  assert.ok(
    upgrade.includes("metadata: { owner_id: session.userId, booster: pack.id }"),
    "a booster session must carry the exact pack id for the webhook",
  );
});

test("checkout never trusts a client price or credit amount", () => {
  const upgrade = read("app/api/billing/upgrade/route.ts");
  // The pack price is computed from the catalog (priceUsd * 100), not a body.
  assert.ok(
    upgrade.includes("unit_amount: pack.priceUsd * 100"),
    "inline price must be derived server-side from the pack catalog",
  );
  assert.ok(
    !/body\??\.(price|priceUsd|amount|credits)/.test(upgrade),
    "the request body must not be read for a price or credit amount",
  );
  // Tier comes from planTier() validation, not a raw body field.
  assert.ok(upgrade.includes("const tier = planTier(body?.tier)"), "tier must be validated");
});

test("the free plan is never sent to Stripe as a paid checkout", () => {
  const stripeCheckout = read("app/api/stripe/checkout/route.ts");
  assert.ok(
    stripeCheckout.includes("if (!tier || tier === \"free\")"),
    "the legacy checkout route must reject the free tier",
  );
  const pricing = read("app/pricing/page.tsx");
  assert.ok(
    pricing.includes("/login?signup=1&next=%2Fpricing"),
    "the free plan must route to onboarding, not checkout",
  );
});

test("duplicate clicks reuse an open Checkout Session instead of creating another", () => {
  for (const rel of ["app/api/billing/upgrade/route.ts", "app/api/stripe/checkout/route.ts"]) {
    const source = read(rel);
    assert.ok(/status: "open"/.test(source), `${rel} must look for open sessions`);
    assert.ok(/reused/.test(source), `${rel} must return a reused session`);
    assert.ok(
      /customer: customer\.id/.test(source),
      `${rel} must scope the lookup to this customer`,
    );
  }
});

// ── Client wiring ─────────────────────────────────────────────────────────

test("the pricing page sells both subscriptions and one-time packs", () => {
  const pricing = read("app/pricing/page.tsx");
  assert.ok(pricing.includes('from "@/lib/billing/boosters"'), "pricing must import the pack catalog");
  assert.ok(pricing.includes('id="boosters"'), "pricing needs an anchorable pack section");
  assert.ok(pricing.includes("BOOSTER_PACKS.map"), "each pack must render a card");
  assert.ok(pricing.includes("void buy({ kind: \"pack\", id: pack.id })"), "packs must be purchasable");
  assert.ok(pricing.includes("void buy({ kind: \"plan\", tier: plan.tier })"), "plans must be purchasable");
});

test("the pricing page preserves intent through login and does not dead-button on load", () => {
  const pricing = read("app/pricing/page.tsx");
  assert.ok(pricing.includes("parseIntent("), "pricing must read a resume intent");
  assert.ok(pricing.includes("/login?next="), "pricing must preserve intent through sign-in");
  assert.ok(pricing.includes("startCheckout(intent)"), "pricing must call the shared checkout");
  // It must not gate the buttons on the async availability fetch (the old
  // "two clicks" defect: the button was disabled until the GET resolved).
  assert.ok(
    !pricing.includes("billing?.available"),
    "pricing must not disable buttons on unfetched availability",
  );
});

test("homepage plan cards each run their own action, not a generic /pricing link", () => {
  const homepage = read("app/homepage/page.tsx");
  assert.ok(homepage.includes("startCheckout"), "homepage must import the shared checkout");
  assert.ok(
    homepage.includes("void buy({ kind: \"plan\", tier: plan.tier })"),
    "each paid plan card must start its own checkout",
  );
  assert.ok(
    !homepage.includes('href={signup ? "/login?signup=1" : "/pricing"}'),
    "paid plan cards must no longer all point at /pricing",
  );
  assert.ok(
    homepage.includes("void buy({ kind: \"pack\", id: pack.id })"),
    "each booster card must start its own pack checkout",
  );
  assert.ok(
    !/booster-card__cta[^>]*href="\/pricing"/.test(homepage),
    "the Buy credits button must not be a bare /pricing link",
  );
  assert.ok(
    homepage.includes("four credit boosters"),
    "the deck copy must match the four approved packs",
  );
});

test("the billing hub shows every plan and both product types", () => {
  const hub = read("app/settings/billing/BillingUpgradeHub.tsx");
  assert.ok(hub.includes("planCards"), "the hub must render the full plan set");
  assert.ok(hub.includes("snapshot?.plans"), "plan cards come from the live snapshot");
  assert.ok(hub.includes("BOOSTER_PACKS"), "the hub must render the pack shelf");
  assert.ok(
    hub.includes("runAction({ tier: plan.tier }"),
    "each plan card must have a plan action",
  );
  assert.ok(
    hub.includes("runAction({ pack: pack.id }"),
    "each pack card must have a purchase action",
  );
});

test("login preserves the intended destination safely", () => {
  const login = read("app/login/page.tsx");
  assert.ok(login.includes("safeNextPath("), "login must validate the next target");
  assert.ok(login.includes("router.push(nextPath)"), "login must honour the next target");
  assert.ok(!/router\.push\("\/dashboard"\)/.test(login), "login must not ignore ?next=");
});

// ── Exactly-once granting and reversal ────────────────────────────────────

test("a paid invoice grants the plan's credits exactly once", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");
  assert.ok(
    webhook.includes("dedupeKey: `inv:${invoice.id}`"),
    "invoice grants must dedupe on the invoice id",
  );
  assert.ok(
    webhook.includes("amount: plan.monthlyCredits"),
    "the grant must use the mapped plan's credit allowance",
  );
  assert.equal(
    (webhook.match(/grantCredits\(/g) ?? []).length,
    2,
    "there must be exactly two grant sites — one per product type",
  );
});

test("a booster session grants the pack's credits exactly once", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");
  assert.ok(
    webhook.includes("dedupeKey: `booster:${session.id}`"),
    "booster grants must dedupe on the checkout session id",
  );
  assert.ok(
    webhook.includes("amount: pack.credits"),
    "the grant must use the catalog pack's credit amount, never a client value",
  );
  assert.ok(
    webhook.includes("boosterPack(session.metadata?.booster)"),
    "the granted pack must be resolved from the catalog server-side",
  );
});

test("a refund reverses a booster grant exactly once per Stripe refund", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");
  assert.ok(
    webhook.includes("const dedupeKey = `refund:${refund.id}`"),
    "each Stripe refund id must reverse at most once",
  );
  assert.ok(
    webhook.includes("processedRefundIds.has(refund.id)"),
    "already-processed refunds must be skipped on replay",
  );
  assert.ok(
    webhook.includes('.eq("dedupe_key", `booster:${session.id}`)'),
    "grants made before paymentIntent was recorded must still be found to reverse",
  );
});
