import { intentBody, type PurchaseIntent } from "./purchaseIntent";

/**
 * Client-side entry point for every purchase — one subscription tier or one
 * credit booster pack.
 *
 * Both product types go through the single `/api/billing/upgrade` door, which
 * validates the caller, resolves the authoritative Stripe price server-side,
 * and returns either a Stripe Checkout URL (new or a reused open session) or a
 * message for an in-place subscription change. The browser never sends a
 * price, a credit amount or a Stripe id — only which catalog item was chosen.
 */

export type CheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "updated"; message: string }
  | { status: "auth" }
  | { status: "error"; message: string };

/** The caller's access token, or null when signed out / the client is missing. */
export async function accessToken(): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function startCheckout(intent: PurchaseIntent): Promise<CheckoutResult> {
  const token = await accessToken();
  if (!token) return { status: "auth" };

  try {
    const response = await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(intentBody(intent)),
    });
    const payload = (await response.json().catch(() => null)) as
      | { url?: string; message?: string; error?: string }
      | null;

    if (response.status === 401) return { status: "auth" };
    if (!response.ok) {
      return {
        status: "error",
        message: payload?.error ?? `That did not go through (HTTP ${response.status}). Try again.`,
      };
    }
    if (payload?.url) return { status: "redirect", url: payload.url };

    return {
      status: "updated",
      message: payload?.message ?? "Your account is updating now.",
    };
  } catch {
    return { status: "error", message: "Could not reach billing. Check your connection and try again." };
  }
}
