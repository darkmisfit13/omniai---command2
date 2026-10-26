import type { ProviderFailureReason } from "./types";

/**
 * Matrix Network Connector Hub — provider cooldown registry.
 *
 * The router already walks the pipeline order and falls through on failure.
 * What it lacked was *memory*: a provider that just returned HTTP 429 was
 * retried on the very next request and failed again, burning latency against
 * a route that is known to be down.
 *
 * This registry gives the gateway a short-lived health memory. When a route
 * trips a rate-limit, a credit deficit or a timeout, it is parked for a
 * backoff window (growing with repeated strikes, capped) so subsequent
 * requests are steered straight to a healthy fallback route — automatic
 * failover that keeps generation up without human intervention.
 *
 * The state is intentionally process-local and time-based: it is a routing
 * hint, never a source of truth, and it self-clears. If every route is in
 * cooldown the router still tries them (a stale hint must never fully block a
 * pipeline).
 */

export type CooldownKind = "quota" | "timeout" | "error";

/** Base backoff per failure class, in milliseconds. */
const BASE_BACKOFF_MS: Record<CooldownKind, number> = {
  quota: 60_000, // rate limit / credit deficit — wait a minute
  timeout: 20_000, // slow/unreachable route — short park
  error: 15_000, // transient upstream error
};

const MAX_STRIKES = 4;

interface CooldownEntry {
  until: number;
  kind: CooldownKind;
  strikes: number;
}

const registry = new Map<string, CooldownEntry>();

/** Map a provider failure to a cooldown class. Timeouts masquerade as errors. */
export function classifyFailure(
  reason: ProviderFailureReason,
  status?: number,
  message?: string
): CooldownKind {
  if (reason === "quota") return "quota";
  if (status === 429 || status === 402) return "quota";
  if (
    status === 408 ||
    status === 504 ||
    /timed?\s*out|timeout|abort/i.test(message ?? "")
  ) {
    return "timeout";
  }
  return "error";
}

/** Park a provider route. Repeated strikes multiply the backoff (capped). */
export function markCooldown(
  providerId: string,
  kind: CooldownKind,
  now: number = Date.now()
): CooldownEntry {
  const previous = registry.get(providerId);
  const strikes = Math.min((previous?.strikes ?? 0) + 1, MAX_STRIKES);
  const entry: CooldownEntry = {
    until: now + BASE_BACKOFF_MS[kind] * strikes,
    kind,
    strikes,
  };
  registry.set(providerId, entry);
  return entry;
}

/** True if the provider is currently parked. Expired entries self-clear. */
export function inCooldown(providerId: string, now: number = Date.now()): boolean {
  const entry = registry.get(providerId);
  if (!entry) return false;
  if (entry.until <= now) {
    registry.delete(providerId);
    return false;
  }
  return true;
}

/** Clear one provider, or the whole registry, on success / manual reset. */
export function clearCooldown(providerId?: string): void {
  if (providerId) registry.delete(providerId);
  else registry.clear();
}

export interface CooldownReport {
  provider: string;
  kind: CooldownKind;
  strikes: number;
  remainingMs: number;
}

/** Snapshot of parked routes — surfaced by the Connector Hub health view. */
export function cooldownReport(now: number = Date.now()): CooldownReport[] {
  const out: CooldownReport[] = [];
  for (const [provider, entry] of registry) {
    if (entry.until <= now) {
      registry.delete(provider);
      continue;
    }
    out.push({
      provider,
      kind: entry.kind,
      strikes: entry.strikes,
      remainingMs: entry.until - now,
    });
  }
  return out.sort((a, b) => b.remainingMs - a.remainingMs);
}

/** Test seam — wipe all state. */
export function resetCooldowns(): void {
  registry.clear();
}
