import rawConfig from "@/config/generation.json";
import type { GenerationConfig } from "./types";

/**
 * Static, server-side generation routing table. It is intentionally bundled
 * (imported JSON) so Vercel serverless functions do not depend on reading the
 * filesystem at runtime.
 *
 * Media pipelines (image/music/video) must never fall back to local processing.
 * That invariant is asserted here so a bad config edit fails loudly instead of
 * silently running a heavy model on the laptop.
 */
export const generationConfig = rawConfig as unknown as GenerationConfig;

const MEDIA_PIPELINES = ["image", "music", "video"] as const;

for (const pipeline of MEDIA_PIPELINES) {
  const definition = generationConfig.pipelines[pipeline];
  if (!definition) {
    throw new Error(`generation.json is missing the "${pipeline}" pipeline.`);
  }
  if (definition.allow_local_fallback) {
    throw new Error(
      `generation.json must keep allow_local_fallback=false for the "${pipeline}" media pipeline.`
    );
  }
}

/**
 * Secrets the owner saved from Media Studio, keyed by the environment-variable
 * name they stand in for (e.g. "HUGGINGFACE_API_KEY"). They are decrypted
 * server-side only and never sent to the browser.
 */
export type KeyOverrides = Record<string, string>;

/**
 * Resolve a single environment-variable value, preferring a real environment
 * variable and falling back to a value the owner saved in Media Studio.
 */
export function resolveEnvValue(
  name: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
  overrides: KeyOverrides = {}
): string | null {
  if (!name) return null;
  const fromEnv = env[name]?.trim();
  if (fromEnv) return fromEnv;
  const stored = overrides[name]?.trim();
  if (stored) return stored;
  return null;
}

/** Resolve the first non-empty value for a provider's key (env, then stored). */
export function resolveProviderKey(
  providerId: string,
  env: Record<string, string | undefined> = process.env,
  overrides: KeyOverrides = {}
): string | null {
  const provider = generationConfig.providers[providerId];
  if (!provider) return null;

  const candidates = [provider.keyEnv, ...(provider.keyEnvAlt ?? [])].filter(
    (name): name is string => Boolean(name)
  );

  for (const name of candidates) {
    const value = resolveEnvValue(name, env, overrides);
    if (value) return value;
  }

  return null;
}
