import { generationConfig } from "./config";
import type { KeyOverrides } from "./config";
import { runProvider } from "./providers";
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
      : `Free cloud ${pipeline} generation is scarce. Add a Pollinations (Pollen credits) or Hugging Face key, or switch the pipeline order in config/generation.json.`
  );
  return parts.join(" ");
}

/**
 * Try each provider for a pipeline in the configured order.
 *
 * Rules (from config/generation.json):
 *  - Cloud providers only for media. There is NO local media fallback.
 *  - On a quota/missing-key failure, move to the next cloud provider.
 *  - When every provider is unavailable, return a failed result + guidance so
 *    the caller can raise a "switch provider" notification.
 */
export async function generateMedia(
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions = {},
  keys: KeyOverrides = {}
): Promise<GenerationResult> {
  const pipelineConfig = generationConfig.pipelines[pipeline];
  if (!pipelineConfig) {
    throw new Error(`No generation pipeline named "${pipeline}".`);
  }

  const attempts: ProviderAttempt[] = [];

  for (const providerId of pipelineConfig.order) {
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

    try {
      const media = await runProvider(providerId, pipeline, prompt, options, keys);
      attempts.push({ provider: providerId, label: provider.label, ok: true });
      return { ok: true, media, attempts };
    } catch (error) {
      const providerError = toProviderError(error);
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
