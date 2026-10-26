/**
 * Purchase intent — the plan or credit pack a user asked to buy, carried
 * across the sign-in boundary.
 *
 * A signed-out visitor who clicks "Omni Pro" must not lose that choice when
 * they are bounced to /login. Encoding the intent in the URL (`?buy=pro`,
 * `?pack=spark-250`) and resuming it after authentication is the whole point
 * of this module.
 *
 * It is deliberately dependency-free: no catalog import, no React, no browser
 * globals. The caller passes the set of valid ids, so this stays a pure
 * function that `node --test` can exercise directly, and the catalog remains
 * the single source of truth (nothing here can drift from it).
 */

export type PurchaseIntent =
  | { kind: "plan"; tier: string }
  | { kind: "pack"; id: string };

/**
 * The valid values an intent may name. Built by the caller from the billing
 * catalog (paid plan tiers and booster pack ids) so there is no second list
 * to keep in sync.
 */
export type IntentCatalog = {
  /** Paid plan tiers a purchase intent may select (e.g. creator/pro/business). */
  tiers: readonly string[];
  /** Booster pack ids a purchase intent may select (e.g. spark-250). */
  packs: readonly string[];
};

/**
 * Read a purchase intent from URL search params.
 *
 * Only ids the caller lists as valid are accepted; anything else (an unknown
 * pack, a stale tier, a hostile value) reads as "no intent" rather than being
 * forwarded to the server. The server validates again — this is the client
 * half of the same check.
 */
export function parseIntent(
  get: (key: string) => string | null | undefined,
  catalog: IntentCatalog
): PurchaseIntent | null {
  const pack = get("pack");
  if (typeof pack === "string" && catalog.packs.includes(pack)) {
    return { kind: "pack", id: pack };
  }

  const buy = get("buy");
  if (typeof buy === "string" && catalog.tiers.includes(buy)) {
    return { kind: "plan", tier: buy };
  }

  return null;
}

/** The query string (without "?") that carries an intent through login. */
export function intentQuery(intent: PurchaseIntent): string {
  return intent.kind === "plan"
    ? `buy=${encodeURIComponent(intent.tier)}`
    : `pack=${encodeURIComponent(intent.id)}`;
}

/** A full internal path (with intent) suitable for a login `next` target. */
export function intentPath(intent: PurchaseIntent, base = "/pricing"): string {
  return `${base}?${intentQuery(intent)}`;
}

/** The JSON body POSTed to /api/billing/upgrade for this intent. */
export function intentBody(intent: PurchaseIntent): Record<string, string> {
  return intent.kind === "plan" ? { tier: intent.tier } : { pack: intent.id };
}

/**
 * A post-login redirect target that cannot leave the site.
 *
 * Only a same-origin absolute path is allowed. Protocol-relative (`//evil`),
 * absolute URLs (`https://evil`), backslash tricks and empty values all fall
 * back to the dashboard, so `?next=` can never be used as an open redirect.
 */
export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
