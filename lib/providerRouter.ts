/** Provider-neutral routing layer — free/local first.
 * Keeps paid Claude, OpenAI disabled unless env explicitly permits.
 * Records sanitized metadata; never logs secrets.
 */
export type ProviderName = "groq" | "gemini" | "claude" | "gpt" | "ollama";
export interface RoutingMetadata {
  provider: ProviderName;
  model?: string;
  reason: string;
  latencyMs?: number;
  outcome: "ok" | "fallback" | "error";
  fallbackPath?: ProviderName;
  costEstimate?: number;
}

export const FREE_PROVIDERS: ProviderName[] = ["ollama", "groq", "gemini"];
export const PAID_PROVIDERS: ProviderName[] = ["claude", "gpt"];

export function isFree(name: ProviderName) {
  return FREE_PROVIDERS.includes(name);
}

export function isPaid(name: ProviderName) {
  return PAID_PROVIDERS.includes(name);
}

export function isPaidEnabled(): boolean {
  return process.env.ALLOW_PAID_FALLBACK === "true";
}

export function detectAvailable(providers: ProviderName[]): ProviderName[] {
  // Real detection would check headers/env; here we honor env config.
  return providers.filter((p) => {
    if (isPaid(p) && !isPaidEnabled()) return false;
    return true;
  });
}

export function buildRoutingOrder(preferred?: ProviderName[]): ProviderName[] {
  const order = preferred ?? [...FREE_PROVIDERS, ...PAID_PROVIDERS];
  return detectAvailable(order);
}

export function sanitizeMetadata(m: RoutingMetadata): RoutingMetadata {
  const s = { ...m };
  // No secrets, no model internals beyond name.
  delete (s as Record<string, unknown>).apiKey;
  return s;
}