import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOSTER_PACKS,
  boosterPack,
  boosterPriceEnvKey,
  boosterPriceId,
} from "../lib/billing/boosters.ts";

/**
 * The booster shelf is the only thing standing between a click and a Stripe
 * charge, so the catalogue invariants that the checkout and the webhook both
 * rely on are worth pinning: unique ids, positive credits, positive prices.
 */

test("every booster pack has a unique id", () => {
  const ids = BOOSTER_PACKS.map((pack) => pack.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every booster pack injects a positive credit block at a positive price", () => {
  for (const pack of BOOSTER_PACKS) {
    assert.ok(pack.credits > 0, `${pack.id} has non-positive credits`);
    assert.ok(pack.priceUsd > 0, `${pack.id} has a non-positive price`);
    assert.ok(pack.name.trim().length > 0, `${pack.id} has no name`);
  }
});

test("the +500 Studio Credits pack the hub advertises exists", () => {
  const pack = BOOSTER_PACKS.find((entry) => entry.credits === 500);
  assert.ok(pack, "no 500-credit booster pack");
});

test("boosterPriceEnvKey produces the documented env var name", () => {
  assert.equal(boosterPriceEnvKey("spark-250"), "STRIPE_PRICE_BOOSTER_SPARK_250");
  assert.equal(boosterPriceEnvKey("studio-500"), "STRIPE_PRICE_BOOSTER_STUDIO_500");
  assert.equal(boosterPriceEnvKey("power-1500"), "STRIPE_PRICE_BOOSTER_POWER_1500");
  assert.equal(boosterPriceEnvKey("atlas-4000"), "STRIPE_PRICE_BOOSTER_ATLAS_4000");
});

test("boosterPriceId returns undefined when no env var is set", () => {
  // None of the STRIPE_PRICE_BOOSTER_* vars are set in the test environment.
  for (const pack of BOOSTER_PACKS) {
    assert.equal(boosterPriceId(pack.id), undefined, `${pack.id} should have no configured price in tests`);
  }
});

test("pack price covers the credit cost at a sane rate", () => {
  for (const pack of BOOSTER_PACKS) {
    const creditsPerDollar = pack.credits / pack.priceUsd;
    assert.ok(creditsPerDollar >= 20, `${pack.id} rate ${creditsPerDollar.toFixed(1)} cr/$ is unreasonably low`);
    assert.ok(creditsPerDollar <= 200, `${pack.id} rate ${creditsPerDollar.toFixed(1)} cr/$ is unreasonably high`);
  }
});

test("Spark pack is $9 for 250 credits, not $250", () => {
  const spark = boosterPack("spark-250");
  assert.ok(spark, "spark-250 pack must exist");
  assert.equal(spark.priceUsd, 9, "Spark price must be $9");
  assert.equal(spark.credits, 250, "Spark credits must be 250");
  // Inline price_data amount in cents (priceUsd * 100).
  assert.equal(spark.priceUsd * 100, 900, "Spark checkout amount must be 900 cents");
});

test("all packs have correct price/credit pairs", () => {
  const expected = {
    "spark-250": { priceUsd: 9, credits: 250 },
    "studio-500": { priceUsd: 16, credits: 500 },
    "power-1500": { priceUsd: 42, credits: 1500 },
    "atlas-4000": { priceUsd: 99, credits: 4000 },
  };
  for (const [id, exp] of Object.entries(expected)) {
    const pack = boosterPack(id);
    assert.ok(pack, `${id} must exist`);
    assert.equal(pack.priceUsd, exp.priceUsd, `${id} price must be $${exp.priceUsd}`);
    assert.equal(pack.credits, exp.credits, `${id} credits must be ${exp.credits}`);
    assert.equal(pack.priceUsd * 100, exp.priceUsd * 100, `${id} checkout cents must be ${exp.priceUsd * 100}`);
  }
});

test("no pack uses its credit count as its dollar price", () => {
  for (const pack of BOOSTER_PACKS) {
    assert.notEqual(pack.priceUsd, pack.credits, `${pack.id}: priceUsd must not equal credits`);
    assert.ok(pack.priceUsd < pack.credits, `${pack.id}: price should be less than credits`);
  }
});
