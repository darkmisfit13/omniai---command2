import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRefundReversal,
  computeCumulativeReversal,
} from "../lib/billing/refundPolicy.ts";

/**
 * Refund policy calculation tests.
 *
 * These test the pure calculation logic. Full integration tests (webhook
 * delivery, Stripe API calls, DB inserts) require a test harness with mocked
 * Stripe and Supabase clients.
 */

// ── computeRefundReversal ──────────────────────────────────────────────

test("full refund before any credits used reverses the entire grant", () => {
  const result = computeRefundReversal({
    originalGrantCredits: 250,
    originalChargeCents: 900,
    refundedCents: 900,
    alreadyReversedCredits: 0,
  });
  assert.equal(result.reversalCredits, 250);
  assert.equal(result.reason, "full-reversal");
});

test("partial refund reverses proportionally", () => {
  const result = computeRefundReversal({
    originalGrantCredits: 250,
    originalChargeCents: 900,
    refundedCents: 450, // half
    alreadyReversedCredits: 0,
  });
  assert.equal(result.reversalCredits, 125); // 250 * 0.5 = 125
  assert.equal(result.reason, "partial-reversal");
});

test("refund after all credits consumed reverses nothing", () => {
  const result = computeRefundReversal({
    originalGrantCredits: 250,
    originalChargeCents: 900,
    refundedCents: 900,
    alreadyReversedCredits: 250, // all already reversed
  });
  assert.equal(result.reversalCredits, 0);
  assert.equal(result.reason, "all-credits-consumed");
});

test("refund with already partially reversed credits caps correctly", () => {
  const result = computeRefundReversal({
    originalGrantCredits: 250,
    originalChargeCents: 900,
    refundedCents: 450,
    alreadyReversedCredits: 125, // 125 already reversed
  });
  // Proportional: 250 * 0.5 = 125, but remaining = 250 - 125 = 125, so capped at 125
  assert.equal(result.reversalCredits, 125);
});

test("invalid inputs return zero reversal", () => {
  assert.equal(computeRefundReversal({ originalGrantCredits: 0, originalChargeCents: 900, refundedCents: 900, alreadyReversedCredits: 0 }).reversalCredits, 0);
  assert.equal(computeRefundReversal({ originalGrantCredits: 250, originalChargeCents: 0, refundedCents: 900, alreadyReversedCredits: 0 }).reversalCredits, 0);
  assert.equal(computeRefundReversal({ originalGrantCredits: 250, originalChargeCents: 900, refundedCents: 0, alreadyReversedCredits: 0 }).reversalCredits, 0);
});

test("reversal never goes negative", () => {
  const result = computeRefundReversal({
    originalGrantCredits: 100,
    originalChargeCents: 1000,
    refundedCents: 1000,
    alreadyReversedCredits: 100, // all already reversed
  });
  assert.equal(result.reversalCredits, 0);
  assert.equal(result.reason, "all-credits-consumed");
});

test("minimum 1 credit reversal when proportional amount rounds to at least 1", () => {
  // 4 cents on $9 → 250 * 4/900 = 1.11 → rounds to 1
  const result = computeRefundReversal({
    originalGrantCredits: 250,
    originalChargeCents: 900,
    refundedCents: 4,
    alreadyReversedCredits: 0,
  });
  assert.ok(result.reversalCredits >= 1, "should reverse at least 1 credit");
});

// ── computeCumulativeReversal ──────────────────────────────────────────

test("cumulative reversal across multiple partial refunds", () => {
  const result = computeCumulativeReversal(
    [{ refundedCents: 300 }, { refundedCents: 300 }, { refundedCents: 300 }],
    250, // original grant
    900  // original charge
  );
  // Each refund: 250 * (300/900) = 83.33 → 83
  // Total: 83 + 83 + 83 = 249 (capped at 250)
  assert.ok(result.totalReversalCredits <= 250, "total reversal must not exceed original grant");
  assert.equal(result.reversalPerRefund.length, 3);
});

test("cumulative reversal caps at original grant", () => {
  const result = computeCumulativeReversal(
    [{ refundedCents: 450 }, { refundedCents: 450 }],
    250,
    900
  );
  // First: 250 * 0.5 = 125, second: 250 * 0.5 = 125, total = 250 (capped)
  assert.ok(result.totalReversalCredits <= 250);
});

test("cumulative reversal with zero refunds returns zero", () => {
  const result = computeCumulativeReversal([], 250, 900);
  assert.equal(result.totalReversalCredits, 0);
  assert.equal(result.reversalPerRefund.length, 0);
});

test("cumulative reversal with invalid inputs returns zero", () => {
  assert.equal(computeCumulativeReversal([{ refundedCents: 100 }], 0, 900).totalReversalCredits, 0);
  assert.equal(computeCumulativeReversal([{ refundedCents: 100 }], 250, 0).totalReversalCredits, 0);
  assert.equal(computeCumulativeReversal([{ refundedCents: 0 }], 250, 900).totalReversalCredits, 0);
});

test("cumulative reversal handles refund after full reversal", () => {
  const result = computeCumulativeReversal(
    [{ refundedCents: 900 }, { refundedCents: 100 }],
    250,
    900
  );
  // First: full reversal (250), second: 0 (nothing left)
  assert.equal(result.reversalPerRefund[0], 250);
  assert.equal(result.reversalPerRefund[1], 0);
  assert.equal(result.totalReversalCredits, 250);
});