import { generationConfig } from "./config";
import type { KeyOverrides } from "./config";
import { runProvider } from "./providers";
import { classifyFailure, clearCooldown, inCooldown, markCooldown } from "./cooldown";
import {
  ProviderError,
  type GenerateOptions,
  type GenerationResult,
  type MediaPipeline,
  type ProviderAttempt,
} from "./types";

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : "Unknown provider error.";
  return new ProviderError("error", message);
}

/** Short, actionable next step shown when every free provider is exhausted. */
function guidanceFor(pipeline: MediaPipeline, attempts: ProviderAttempt[]): string {
  const missing = attempts.filter((a) => a.reason === "missing_key");
  const exhausted = attempts.filter((a) => a.reason === "quota");

  const parts: string[] = [];
  if (exhausted.length > 0) {
    parts.push(
      `These providers hit their limit: ${exhausted.map((a) => a.label).join(", ")}.`
    );
  }
  if (missing.length > 0) {
    parts.push(
      `Add an API key to unlock: ${missing.map((a) => a.label).join(", ")}.`
    );
  }
  parts.push(
    pipeline === "image"
      ? "Free image generation normally works out of the box via Pollinations. Add a Hugging Face or Cloudflare key for more headroom."
      : pipeline === "voice"
        ? "Speech needs a connected voice provider. Add your ElevenLabs key (and optionally a Lovable key) in Admin -> AI Providers."
        : `Free cloud ${pipeline} generation is scarce. Add a Pollinations (Pollen credits) or Hugging Face key, or switch the pipeline order in config/generation.json.`
  );
  return parts.join(" ");
}

/**
 * Try each provider for a pipeline in the configured order.
 *
 * Rules (from config/generation.json):
 *  - Cloud providers only for media. There is NO local media fallback.
 *  - Providers the owner switched off in Admin -> AI Providers are skipped.
 *  - On a quota/missing-key failure, move to the next cloud provider.
 *  - When every provider is unavailable, return a failed result + guidance so
 *    the caller can raise a "switch provider" notification.
 */
export async function generateMedia(
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions = {},
  keys: KeyOverrides = {},
  disabled: Set<string> = new Set()
): Promise<GenerationResult> {
  const pipelineConfig = generationConfig.pipelines[pipeline];
  if (!pipelineConfig) {
    throw new Error(`No generation pipeline named "${pipeline}".`);
  }

  const attempts: ProviderAttempt[] = [];

  // Matrix Network Connector Hub — health-aware route ordering.
  //
  // Routes that recently rate-limited, ran out of credit or timed out are
  // parked for a backoff window and pushed to the back of the queue, so the
  // next request fails over to a healthy route immediately. Parked routes are
  // still attempted as a last resort: a stale hint must never hard-block a
  // pipeline. A successful call clears the route's cooldown.
  const healthy: string[] = [];
  const parked: string[] = [];
  for (const id of pipelineConfig.order) (inCooldown(id) ? parked : healthy).push(id);
  const attemptOrder = [...healthy, ...parked];

  for (const providerId of attemptOrder) {
    const provider = generationConfig.providers[providerId];
    if (!provider) {
      attempts.push({
        provider: providerId,
        label: providerId,
        ok: false,
        reason: "error",
        message: "Unknown provider in the pipeline order.",
      });
      continue;
    }

    if (disabled.has(providerId)) {
      attempts.push({
        provider: providerId,
        label: provider.label,
        ok: false,
        reason: "error",
        message: "Turned off in Admin -> AI Providers.",
      });
      continue;
    }

    try {
      const media = await runProvider(providerId, pipeline, prompt, options, keys);
      clearCooldown(providerId); // route recovered — remove any stale park
      attempts.push({ provider: providerId, label: provider.label, ok: true });
      return { ok: true, media, attempts };
    } catch (error) {
      const providerError = toProviderError(error);
      markCooldown(
        providerId,
        classifyFailure(providerError.kind, providerError.status, providerError.message)
      );
      attempts.push({
        provider: providerId,
        label: provider.label,
        ok: false,
        reason: providerError.kind,
        status: providerError.status,
        message: providerError.message,
      });
      // Always continue down the cloud list; never touch local for media.
    }
  }

  return {
    ok: false,
    attempts,
    exhausted: true,
    guidance: guidanceFor(pipeline, attempts),
  };
}
