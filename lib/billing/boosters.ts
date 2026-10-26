/**
 * Credit Booster Packs — one-time top-ups that inject a block of credits into
 * an account without touching its subscription.
 *
 * These are deliberately a slightly worse rate than the best subscription
 * (Business is ~101 credits/$) but a better one than the smallest plan
 * (Creator is ~53 credits/$). A subscriber is rewarded for committing; someone
 * who only needs 500 more credits before a deadline pays a small premium for
 * the convenience. That is the honest shape of a top-up, and it keeps the
 * subscription the thing worth buying.
 *
 * Nothing here is a source of truth for money: the credits are only ever
 * granted by the Stripe webhook, deduped on the Checkout Session id, exactly
 * like a plan grant. This module just describes the shelf.
 */

export type BoosterPack = {
  /** Stable id written to Stripe metadata and the ledger action. */
  id: string;
  name: string;
  credits: number;
  /** Whole dollars, charged once. */
  priceUsd: number;
  blurb: string;
  /** Optional ribbon, e.g. "Best value". */
  badge?: string;
};

/**
 * Customer-facing names (approved catalog). The `id` values are stable
 * identifiers written to Stripe metadata, checkout session metadata, the
 * ledger dedupe keys and webhook lookups — they are never renamed.
 */
export const BOOSTER_PACKS: BoosterPack[] = [
  {
    id: "micro_booster",
    name: "Omni Spark",
    credits: 300,
    priceUsd: 5,
    blurb: "A quick burst for a few images or a voiceover.",
  },
  {
    id: "creator_booster",
    name: "Omni Pulse",
    credits: 850,
    priceUsd: 12,
    blurb: "+850 credits — enough for a busy creative afternoon.",
  },
  {
    id: "studio_booster",
    name: "Omni Surge",
    credits: 2000,
    priceUsd: 25,
    blurb: "Room for a video pass plus a full stack of images.",
    badge: "Most popular",
  },
  {
    id: "mastermind_booster",
    name: "Omni Infinity",
    credits: 4500,
    priceUsd: 50,
    blurb: "A heavy block of premium model tokens that never expire.",
    badge: "Best value",
  },
];

const BY_ID = new Map(BOOSTER_PACKS.map((pack) => [pack.id, pack]));

export function boosterPack(id: unknown): BoosterPack | undefined {
  return typeof id === "string" ? BY_ID.get(id) : undefined;
}

/**
 * Returns the env key that holds the Stripe Price ID for this booster.
 * Mapping uses the new flat env var names matching PRICE_MAPPING in checkout:
 *   micro_booster    → STRIPE_MICRO_BOOSTER_PRICE_ID
 *   creator_booster  → STRIPE_CREATOR_BOOSTER_PRICE_ID
 *   studio_booster   → STRIPE_STUDIO_BOOSTER_PRICE_ID
 *   mastermind_booster → STRIPE_MASTERMIND_BOOSTER_PRICE_ID
 */
export function boosterPriceEnvKey(id: string): string {
  return `STRIPE_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_PRICE_ID`;
}

export function boosterPriceId(id: string): string | undefined {
  const value = process.env[boosterPriceEnvKey(id)];
  return value && value.startsWith("price_") ? value : undefined;
}
