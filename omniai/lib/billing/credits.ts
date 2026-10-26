import type { SupabaseClient } from "@supabase/supabase-js";
import { creditCost, totalCredits } from "@/lib/billing/creditTable";

/**
 * Charge, and refund on failure.
 *
 * The ledger is append-only, so "hold then settle" needs no separate holds
 * table: the charge *is* the hold, and a failure is corrected by writing its
 * compensating row. Net zero, two rows, and the refund leaves a trail instead
 * of quietly erasing one.
 *
 * Everything here runs against the caller's own JWT — no service-role key is
 * involved. That is deliberate: omni_charge_credits derives its owner from
 * auth.uid(), so a client can only ever spend its own balance.
 */

export const PIPELINE_DEFAULT_ACTION = {
  image: "image:standard",
  music: "music:standard",
  video: "video:standard",
} as const;

const ACTION_GROUP: Record<string, string> = {
  "image:free": "image",
  "image:standard": "image",
  "image:hd": "image",
  "image:premium": "image",
  "image:fal": "image",
  "image_edit:standard": "image",
  "image_edit:premium": "image",
  "video:short": "video",
  "video:standard": "video",
  "video:hd": "video",
  "video:premium": "video",
  "video:fal": "video",
  "music:standard": "music",
  "music_video:standard": "music",
};

/**
 * Pick what to charge for a request.
 *
 * A client may name a tier — the media page asks for HD when the user picked
 * HD — but only within the pipeline it is actually running. Anything absent,
 * unknown or from the wrong group falls back to the pipeline's default, so the
 * worst a hostile client can do is pay the standard price for what it asked.
 */
export function resolveCreditAction(
  pipeline: "image" | "music" | "video",
  requested: unknown
): string {
  const fallback = PIPELINE_DEFAULT_ACTION[pipeline];
  if (typeof requested !== "string" || !creditCost(requested)) return fallback;
  if (ACTION_GROUP[requested] !== pipeline) return fallback;
  return requested;
}

/** Credits for a request, including any metered tail past the included seconds. */
export function costOf(action: string, seconds = 0): number {
  return totalCredits(action, seconds) ?? 0;
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /could not find the function|omni_charge_credits|omni_refund_credits/i.test(
    error.message ?? ""
  );
}

export type ChargeOutcome =
  | { ok: true; ref: string; action: string; cost: number; balance: number | null }
  | { ok: false; kind: "insufficient" | "unavailable"; message: string };

export async function chargeCredits(
  client: SupabaseClient,
  action: string,
  ref: string,
  seconds = 0
): Promise<ChargeOutcome> {
  const cost = costOf(action, seconds);
  if (cost <= 0) {
    return { ok: true, ref, action, cost: 0, balance: null };
  }

  const { data, error } = await client.rpc("omni_charge_credits", {
    p_amount: cost,
    p_action: action,
    p_ref: ref,
  });

  if (error) {
    if (isMissingFunction(error)) {
      return {
        ok: false,
        kind: "unavailable",
        message:
          "Billing is not enabled on this database yet. Run the migrations 20261014100000 and 20261014110000 in the Supabase SQL editor, then try again.",
      };
    }
    if (/insufficient/i.test(error.message ?? "")) {
      return {
        ok: false,
        kind: "insufficient",
        message: "Not enough credits for that action. Top up or switch plan to continue.",
      };
    }
    return { ok: false, kind: "unavailable", message: error.message ?? "Could not reserve credits." };
  }

  return { ok: true, ref, action, cost, balance: typeof data === "number" ? data : null };
}

export type RefundOutcome = { refunded: boolean; message?: string };

/**
 * Best effort, and reported rather than swallowed. If a refund ever failed
 * silently the user would simply lose credits with no explanation — so the
 * caller surfaces this instead of pretending the ledger balanced.
 */
export async function refundCredits(client: SupabaseClient, ref: string): Promise<RefundOutcome> {
  const { error } = await client.rpc("omni_refund_credits", { p_ref: ref });

  if (!error) return { refunded: true };

  if (isMissingFunction(error)) {
    return { refunded: false, message: "The billing migration has not been run, so no charge was made." };
  }

  if (error.code === "PGRST116" || /no charge found/i.test(error.message ?? "")) {
    return { refunded: true };
  }

  return { refunded: false, message: error.message ?? "The automatic refund did not apply." };
}
