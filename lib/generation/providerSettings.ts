import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Provider enable/disable state, stored in public.provider_settings.
 *
 * Deleting an API key disconnects a provider; this is the softer switch: keep
 * the key, pause the provider. Every reader fails soft — if the table has not
 * been migrated yet, nothing is disabled and the routers behave exactly as
 * before, rather than breaking generation over a missing admin table.
 */

const TABLE = "provider_settings";

/** Provider ids the caller's session can see as switched off. */
export async function loadDisabledProviders(
  client: SupabaseClient
): Promise<Set<string>> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .select("provider_id, enabled")
      .eq("enabled", false);
    if (error || !data) return new Set();
    return new Set(data.map((row) => row.provider_id as string));
  } catch {
    return new Set();
  }
}

/** Full enabled map (missing rows default to enabled). */
export async function loadProviderStates(
  client: SupabaseClient
): Promise<{ states: Record<string, boolean>; available: boolean }> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .select("provider_id, enabled");
    if (error || !data) return { states: {}, available: false };
    const states: Record<string, boolean> = {};
    for (const row of data) states[row.provider_id] = Boolean(row.enabled);
    return { states, available: true };
  } catch {
    return { states: {}, available: false };
  }
}

/** Owner-only (enforced by RLS): flip a provider on or off. */
export async function setProviderEnabled(
  client: SupabaseClient,
  providerId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await client
    .from(TABLE)
    .upsert(
      { provider_id: providerId, enabled, updated_at: new Date().toISOString() },
      { onConflict: "provider_id" }
    );
  if (error) {
    throw new Error(
      error.code === "42501" || error.message?.toLowerCase().includes("row-level security")
        ? "Only the verified owner can change provider switches."
        : `Could not save the provider switch: ${error.message}. Run the 20261017130000_add_provider_settings migration first.`
    );
  }
}
