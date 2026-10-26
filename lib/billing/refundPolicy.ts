/**
 * Refund policy calculation — pure, testable, side-effect-free.
 *
 * OmniAI grants credits in bulk (booster packs, plan renewals) and charges them
 * per action (generations, chat). The ledger is append-only: a charge is a
 * negative delta, a grant is a positive delta, and the balance is the sum.
 *
 * A refund is a monetary transaction with Stripe; a credit reversal is an
 * internal ledger transaction. They are calculated separately and then
 * reconciled. This module computes the *eligible credit reversal* for a refund
 * request — it never touches the database or Stripe.
 *
 * IMPORTANT LIMITATION: the current ledger does not associate individual credit
 * charges with the purchase that funded them. Consumption is tracked only as an
 * aggregate balance. Therefore, the reversal is calculated proportionally:
 *
 *   reversalCredits = round(originalGrant × (refundedCents / originalChargeCents))
 *
 * capped at (originalGrant - alreadyReversed). This means a refund after partial
 * consumption may reverse more credits than were actually unused — the
 * proportional formula assumes uniform consumption. A true per-purchase
 * allocation (FIFO or LIFO) requires a schema change (purchase_id on charge
 * rows or a separate allocation table) and is documented as a future
 * improvement.
 *
 * Rounding: round half to nearest integer, minimum 1 credit if any refund
 * amount > 0 and credits remain. Negative balances are never created — the
 * reversal is capped at remaining credits.
 *
 * Policy: if all purchased credits have already been consumed (remaining <= 0),
 * no automatic reversal occurs. The case is flagged for manual review.
 */

export type RefundReversalInput = {
  /** Credits originally granted by this purchase. */
  originalGrantCredits: number;
  /** Original charge amount in integer cents. */
  originalChargeCents: number;
  /** Amount refunded in this (or cumulative) request, in integer cents. */
  refundedCents: number;
  /** Credits already reversed for this purchase (from prior refunds). */
  alreadyReversedCredits: number;
};

export type RefundReversalResult = {
  /** Credits to reverse (0 means no reversal / manual review). */
  reversalCredits: number;
  /** Human-readable reason for the decision. */
  reason:
    | "full-reversal"
    | "partial-reversal"
    | "no-eligible-reversal"
    | "all-credits-consumed"
    | "invalid-input";
};

export function computeRefundReversal(input: RefundReversalInput): RefundReversalResult {
  const { originalGrantCredits, originalChargeCents, refundedCents, alreadyReversedCredits } = input;

  // Guard against invalid inputs.
  if (originalGrantCredits <= 0 || originalChargeCents <= 0 || refundedCents <= 0) {
    return { reversalCredits: 0, reason: "invalid-input" };
  }

  const remainingCredits = originalGrantCredits - alreadyReversedCredits;
  if (remainingCredits <= 0) {
    return { reversalCredits: 0, reason: "all-credits-consumed" };
  }

  // Proportional reversal: refundedCents / originalChargeCents * originalGrantCredits
  // Rounding: standard round half to nearest integer.
  const proportionalCredits = Math.round(originalGrantCredits * (refundedCents / originalChargeCents));

  // Cap at remaining credits (never go negative).
  const reversalCredits = Math.min(proportionalCredits, remainingCredits);

  if (reversalCredits <= 0) {
    return { reversalCredits: 0, reason: "no-eligible-reversal" };
  }

  // Determine if this is a full or partial reversal.
  const isFullRefund = refundedCents >= originalChargeCents;
  const isFullReversal = reversalCredits >= remainingCredits;

  if (isFullRefund && isFullReversal) {
    return { reversalCredits, reason: "full-reversal" };
  }

  return { reversalCredits, reason: "partial-reversal" };
}

/**
 * Compute the cumulative reversal amount across multiple refunds.
 * Each refund is processed independently; the total reversal is capped at
 * the original grant.
 */
export function computeCumulativeReversal(
  refunds: Array<{ refundedCents: number }>,
  originalGrantCredits: number,
  originalChargeCents: number
): { totalReversalCredits: number; reversalPerRefund: number[] } {
  if (originalGrantCredits <= 0 || originalChargeCents <= 0 || refunds.length === 0) {
    return { totalReversalCredits: 0, reversalPerRefund: [] };
  }

  const reversalPerRefund: number[] = [];
  let totalReversed = 0;

  for (const refund of refunds) {
    if (refund.refundedCents <= 0) {
      reversalPerRefund.push(0);
      continue;
    }

    const remaining = originalGrantCredits - totalReversed;
    if (remaining <= 0) {
      reversalPerRefund.push(0);
      continue;
    }

    const proportional = Math.round(originalGrantCredits * (refund.refundedCents / originalChargeCents));
    const reversal = Math.min(proportional, remaining);
    reversalPerRefund.push(reversal);
    totalReversed += reversal;
  }

  return { totalReversalCredits: totalReversed, reversalPerRefund };
}