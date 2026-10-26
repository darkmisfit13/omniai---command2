import { authorizeOwner, authorizeUser, isOwnerSession, isUserSession, json } from "@/lib/generation/serverAuth";
import { describeAllPipelines } from "@/lib/generation/inspect";
import { runProvider } from "@/lib/generation/providers";
import { ProviderError, type GenerateOptions, type MediaPipeline } from "@/lib/generation/types";
import { generationConfig, resolveEnvValue, resolveProviderKey } from "@/lib/generation/config";
import { keySecretConfigured, loadStoredKeys } from "@/lib/generation/secretStore";
import { loadDisabledProviders } from "@/lib/generation/providerSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_PIPELINES: MediaPipeline[] = ["image", "music", "video", "voice"];

/** Deliberately tiny + cheap inputs so a "test" barely costs any quota. */
const TEST_PROMPT: Record<MediaPipeline, string> = {
  image: "a scenic landscape with green hills and a clear blue sky",
  music: "a short calm solo piano test tone",
  video: "a red ball slowly rolling across a table",
  voice: "Hello from OmniAI. This is a short provider connection test.",
};

const TEST_OPTIONS: Record<MediaPipeline, GenerateOptions> = {
  image: { width: 64, height: 64, seed: 7 },
  music: { durationSeconds: 4 },
  video: { durationSeconds: 2 },
  voice: {},
};

const MAX_PREVIEW_BYTES = 200_000;

/** GET /api/generate/providers -> per-pipeline provider status (no secrets). */
export async function GET(request: Request) {
  // Any signed-in account: this returns which providers are wired up and
  // whether a secret exists for them — never the secret itself — and the
  // media/music pages read it before letting anyone generate. It answers a
  // question about the platform, not about the caller, so scoping it to the
  // owner would leave every customer staring at a 403 in their library.
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const { envNames } = await loadStoredKeys(session.client);
  const disabled = await loadDisabledProviders(session.client);
  return json({
    pipelines: describeAllPipelines(new Set(envNames)),
    disabled: [...disabled],
    secrets: { configured: keySecretConfigured() },
  });
}

/**
 * POST /api/generate/providers
 * Body: { pipeline, provider }
 * Runs one real, minimal generation against a single provider to prove its key
 * works. Nothing is stored and no provider_alerts are raised.
 */
export async function POST(request: Request) {
  // Stays owner-only, unlike GET above. This does not describe anything — it
  // spends a real generation against a real provider on every call. A paying
  // account should never be able to spend the platform's quota on a whim, and
  // the keys it would test are the platform's, not the caller's.
  const session = await authorizeOwner(request);
  if (!isOwnerSession(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { pipeline?: unknown; provider?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ error: "Send a JSON object with pipeline and provider." }, 400);
  }

  const pipeline = body.pipeline as MediaPipeline;
  if (!VALID_PIPELINES.includes(pipeline)) {
    return json({ error: "pipeline must be image, music, video, or voice." }, 400);
  }

  const provider = typeof body.provider === "string" ? body.provider : "";
  const pipelineConfig = generationConfig.pipelines[pipeline];
  const providerConfig = generationConfig.providers[provider];
  if (!providerConfig || !pipelineConfig?.order.includes(provider)) {
    return json({ error: `"${provider}" is not part of the ${pipeline} pipeline.` }, 400);
  }

  const label = providerConfig.label;
  const model = providerConfig.models[pipeline] ?? null;
  const startedAt = Date.now();

  const { overrides } = await loadStoredKeys(session.client);

  // Short-circuit a missing key/account so the UI gets a precise hint cheaply.
  if (providerConfig.keyRequired && !resolveProviderKey(provider, process.env, overrides)) {
    return json({
      ok: false,
      provider,
      label,
      model,
      reason: "missing_key",
      message: `Set ${providerConfig.keyEnv ?? "the API key"} to enable ${label}.`,
      latencyMs: Date.now() - startedAt,
    });
  }
  if (providerConfig.accountEnv && !resolveEnvValue(providerConfig.accountEnv, process.env, overrides)) {
    return json({
      ok: false,
      provider,
      label,
      model,
      reason: "missing_key",
      message: `Set ${providerConfig.accountEnv} to enable ${label}.`,
      latencyMs: Date.now() - startedAt,
    });
  }

  try {
    const media = await runProvider(
      provider,
      pipeline,
      TEST_PROMPT[pipeline],
      TEST_OPTIONS[pipeline],
      overrides
    );
    const latencyMs = Date.now() - startedAt;
    const payload: Record<string, unknown> = {
      ok: true,
      provider,
      label,
      model: media.model,
      contentType: media.contentType,
      bytes: media.bytes.byteLength,
      latencyMs,
      message: `${label} responded with ${media.contentType} (${media.bytes.byteLength} bytes).`,
    };
    if (pipeline === "image" && media.bytes.byteLength <= MAX_PREVIEW_BYTES) {
      payload.previewDataUrl = `data:${media.contentType};base64,${Buffer.from(media.bytes).toString("base64")}`;
    }
    return json(payload);
  } catch (error) {
    const providerError =
      error instanceof ProviderError
        ? error
        : new ProviderError("error", error instanceof Error ? error.message : "Test failed.");
    return json({
      ok: false,
      provider,
      label,
      model,
      reason: providerError.kind,
      status: providerError.status,
      message: providerError.message,
      latencyMs: Date.now() - startedAt,
    });
  }
}

