import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CREDIT_ACTIONS, PLANS, creditCost, totalCredits } from "../lib/billing/creditTable.ts";
import { BOOSTER_PACKS, boosterPack } from "../lib/billing/boosters.ts";
import { resolveCreditAction } from "../lib/billing/creditPolicy.ts";

/**
 * The approved product, pricing and credit catalog, pinned end to end:
 * customer-facing names, internal identifiers that must never drift, the
 * premium-video duration rule, and the server-side tier derivation that keeps
 * a client from naming a cheaper price.
 */

const ROOT = path.resolve(import.meta.dirname, "..");

// ── Subscription plans ────────────────────────────────────────────────────

test("plan tiers keep their internal identifiers", () => {
  assert.deepEqual(
    PLANS.map((p) => p.tier),
    ["free", "creator", "pro", "business"],
  );
});

test("plan display names and prices match the approved catalog", () => {
  const expected = {
    free: { name: "Omni Free", priceUsd: 0, monthlyCredits: 100 },
    creator: { name: "Omni Plus", priceUsd: 9, monthlyCredits: 1000 },
    pro: { name: "Omni Pro", priceUsd: 24, monthlyCredits: 3000 },
    business: { name: "Omni Ultra", priceUsd: 49, monthlyCredits: 10000 },
  };
  for (const plan of PLANS) {
    const exp = expected[plan.tier];
    assert.equal(plan.name, exp.name, `${plan.tier} must display as ${exp.name}`);
    assert.equal(plan.priceUsd, exp.priceUsd, `${plan.tier} must cost $${exp.priceUsd}`);
    assert.equal(
      plan.monthlyCredits,
      exp.monthlyCredits,
      `${plan.tier} allowance must stay ${exp.monthlyCredits} credits`,
    );
  }
});

test("exactly one plan is free and the paid ladder is ascending", () => {
  const free = PLANS.filter((p) => p.priceUsd === 0);
  assert.equal(free.length, 1, "only Omni Free may cost $0");
  assert.equal(free[0].tier, "free");
  const paid = PLANS.filter((p) => p.priceUsd > 0).map((p) => p.priceUsd);
  for (let i = 1; i < paid.length; i += 1) {
    assert.ok(paid[i] > paid[i - 1], "paid plans must ascend with the tier");
  }
});

// ── Booster packs ─────────────────────────────────────────────────────────

test("booster packs keep their internal ids and approved names/prices", () => {
  const expected = {
    "spark-250": { name: "Omni Spark", credits: 250, priceUsd: 9 },
    "studio-500": { name: "Omni Pulse", credits: 500, priceUsd: 16 },
    "power-1500": { name: "Omni Surge", credits: 1500, priceUsd: 42 },
    "atlas-4000": { name: "Omni Infinity", credits: 4000, priceUsd: 99 },
  };
  assert.equal(BOOSTER_PACKS.length, 4);
  for (const pack of BOOSTER_PACKS) {
    const exp = expected[pack.id];
    assert.ok(exp, `${pack.id} is an approved pack id`);
    assert.equal(pack.name, exp.name, `${pack.id} must display as ${exp.name}`);
    assert.equal(pack.credits, exp.credits);
    assert.equal(pack.priceUsd, exp.priceUsd);
  }
});

// ── Credit table ──────────────────────────────────────────────────────────

test("the credit table matches the approved customer-facing prices exactly", () => {
  const approved = {
    "text:standard": 1,
    "script:standard": 3,
    "text:long": 5,
    "image:free": 2,
    "image:standard": 10,
    "image:fal": 12,
    "image_edit:standard": 13,
    "image:hd": 20,
    "image_edit:premium": 22,
    "image:premium": 30,
    "video:short": 100,
    "video:fal": 150,
    "video:standard": 200,
    "video:hd": 350,
    "video:premium": 600,
    "music:standard": 40,
    "music_video:standard": 400,
    "voice:standard": 10,
    "voice:long": 60,
    "website_analysis:standard": 8,
    "website:edit": 10,
    "website:new": 15,
    "app:blueprint": 8,
    "app:preview": 12,
    "app:scaffold": 16,
    "social:analyze": 5,
  };
  for (const [key, credits] of Object.entries(approved)) {
    const action = creditCost(key);
    assert.ok(action, `${key} must exist in the catalog`);
    assert.equal(action.credits, credits, `${key} must cost ${credits} credits`);
    assert.equal(action.refundOnFailure, true, `${key} must refund on failure`);
  }
  assert.equal(
    CREDIT_ACTIONS.length,
    Object.keys(approved).length,
    "no unapproved extra rows may appear in the catalog",
  );
});

test("premium video includes the first 8 seconds and meters the tail at 40/second", () => {
  const premium = creditCost("video:premium");
  assert.equal(premium.credits, 600);
  assert.equal(premium.includedSeconds, 8);
  assert.equal(premium.perSecond, 40);
});

test("premium video duration rule: at, below and above the included window", () => {
  assert.equal(totalCredits("video:premium", 8), 600, "exactly 8s bills the base price only");
  assert.equal(totalCredits("video:premium", 5), 600, "below 8s bills the base price only");
  assert.equal(totalCredits("video:premium", 9), 640, "9s = 600 + 1 started second");
  assert.equal(totalCredits("video:premium", 12), 760, "12s = 600 + 4 seconds");
});

test("premium video duration rule: fractional and invalid seconds round safely", () => {
  // Any started second past the included window is a whole second (ceiling).
  assert.equal(totalCredits("video:premium", 8.2), 640, "8.2s bills one extra second, not 0.2");
  assert.equal(totalCredits("video:premium", 12.5), 800, "12.5s = 600 + 5 started seconds");
  assert.equal(totalCredits("video:premium", 0), 600, "zero bills the base price");
  assert.equal(totalCredits("video:premium"), 600, "omitted seconds bill the base price");
  assert.equal(totalCredits("video:premium", -3), 600, "negative seconds bill the base price");
  assert.equal(totalCredits("video:premium", Number.NaN), 600, "NaN bills the base price");
});

test("flat-price rows never gain a metered tail", () => {
  for (const action of CREDIT_ACTIONS) {
    if (action.key === "video:premium") continue;
    assert.equal(action.perSecond, 0, `${action.key} must be flat`);
    assert.equal(totalCredits(action.key, 30), action.credits, `${action.key} must ignore seconds`);
  }
});

// ── Server-side tier derivation (no client underpayment) ──────────────────

test("every pipeline defaults to its standard tier", () => {
  assert.equal(resolveCreditAction("image", undefined), "image:standard");
  assert.equal(resolveCreditAction("music", undefined), "music:standard");
  assert.equal(resolveCreditAction("video", undefined), "video:standard");
  assert.equal(resolveCreditAction("voice", undefined), "voice:standard");
});

test("voice tier is derived from script length", () => {
  assert.equal(resolveCreditAction("voice", undefined, { scriptChars: 500 }), "voice:standard");
  assert.equal(resolveCreditAction("voice", undefined, { scriptChars: 501 }), "voice:long");
  assert.equal(resolveCreditAction("voice", undefined, { scriptChars: 2500 }), "voice:long");
  assert.equal(resolveCreditAction("voice", undefined, { scriptChars: 0 }), "voice:standard");
  assert.equal(resolveCreditAction("voice", undefined, { scriptChars: -5 }), "voice:standard");
});

test("a client cannot name a cheaper tier", () => {
  // Hostile requests are silently priced at the derived tier.
  assert.equal(resolveCreditAction("image", "image:free"), "image:standard");
  assert.equal(resolveCreditAction("image", "image:hd"), "image:standard");
  assert.equal(resolveCreditAction("music", "music_video:standard"), "music:standard");
  assert.equal(resolveCreditAction("video", "video:short"), "video:standard");
  assert.equal(
    resolveCreditAction("voice", "voice:standard", { scriptChars: 2500 }),
    "voice:long",
    "a long script must not be billed at the short rate",
  );
  // Cross-pipeline and garbage values fall back to the derived tier.
  assert.equal(resolveCreditAction("image", "video:premium"), "image:standard");
  assert.equal(resolveCreditAction("music", 42), "music:standard");
  assert.equal(resolveCreditAction("video", { price: 1 }), "video:standard");
});

test("a request matching the derived tier still resolves to it", () => {
  assert.equal(resolveCreditAction("image", "image:standard"), "image:standard");
  assert.equal(resolveCreditAction("voice", "voice:long", { scriptChars: 900 }), "voice:long");
});

// ── Navigation structure ──────────────────────────────────────────────────

test("every sidebar link leads to an existing route", () => {
  const sidebar = readFileSync(path.join(ROOT, "app", "Sidebar.tsx"), "utf8");
  const hrefs = [...sidebar.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 20, "expected the full navigation list");

  // /studio/* resolves through the dynamic app/studio/[slug] micro-frontend
  // route, so a studio link is valid only when the registry knows its slug.
  const registry = readFileSync(
    path.join(ROOT, "lib", "microfrontends", "StudioMicrofrontend.tsx"),
    "utf8",
  );
  const slugs = new Set([...registry.matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1]));

  for (const href of hrefs) {
    if (href.startsWith("/studio/")) {
      const slug = href.slice("/studio/".length);
      assert.ok(slugs.has(slug), `${href}: slug "${slug}" missing from the studio registry`);
    } else {
      const page = href === "/"
        ? path.join(ROOT, "app", "page.tsx")
        : path.join(ROOT, "app", href.slice(1), "page.tsx");
      assert.ok(existsSync(page), `${href}: no page at ${path.relative(ROOT, page)}`);
    }
  }
});

test("the retired Media page is gone from the sidebar and redirects safely", () => {
  const sidebar = readFileSync(path.join(ROOT, "app", "Sidebar.tsx"), "utf8");
  assert.ok(!/href: "\/media"/.test(sidebar), "sidebar must not link the retired /media page");
  const mediaPage = readFileSync(path.join(ROOT, "app", "media", "page.tsx"), "utf8");
  assert.ok(
    mediaPage.includes('redirect("/studio/assets")'),
    "/media must redirect to the Media Library",
  );
  // And the routing layer must answer with a real HTTP redirect, not a
  // client-rendered shell, so bookmarks and non-browser clients land right.
  const config = readFileSync(path.join(ROOT, "next.config.js"), "utf8");
  assert.ok(
    /source:\s*"\/media"/.test(config) &&
      /destination:\s*"\/studio\/assets"/.test(config),
    "next.config.js must route /media to the Media Library",
  );
  // The Media Library itself survives.
  assert.ok(existsSync(path.join(ROOT, "app", "assets", "page.tsx")));
});

test("customer-facing navigation keeps the original OmniAI branding", () => {
  const sidebar = readFileSync(path.join(ROOT, "app", "Sidebar.tsx"), "utf8");
  assert.ok(!/CapCut/i.test(sidebar), "CapCut must not appear as customer-facing branding");
});

// ── Homepage booster shelf ────────────────────────────────────────────────

test("the homepage booster shelf is sourced from the shared catalog", () => {
  const homepage = readFileSync(path.join(ROOT, "app", "homepage", "page.tsx"), "utf8");
  assert.ok(
    homepage.includes('from "@/lib/billing/boosters"'),
    "homepage must import BOOSTER_PACKS instead of hardcoding packs",
  );
  assert.ok(
    !homepage.includes("priceUsd: 75"),
    "the retired $75/5000 placeholder pack must not reappear",
  );
  for (const pack of BOOSTER_PACKS) {
    const shelfPack = boosterPack(pack.id);
    assert.equal(shelfPack, pack);
  }
});
