import { generateMedia } from "@/lib/generation/router";
import { authorizeUser, isUserSession, json, type OwnerSession } from "@/lib/generation/serverAuth";
import { chargeCredits, refundCredits, resolveCreditAction } from "@/lib/billing/credits";
import { loadStoredKeys } from "@/lib/generation/secretStore";
import { loadDisabledProviders } from "@/lib/generation/providerSettings";
import type { MediaPipeline } from "@/lib/generation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MEDIA_BUCKET = "media";
const MAX_PROMPT_LENGTH = 2000;
/** voice:long caps at 2500 characters in the credit table. */
const MAX_VOICE_LENGTH = 2500;
const VALID_PIPELINES: MediaPipeline[] = ["image", "music", "video", "voice"];

const KIND_BY_PIPELINE: Record<MediaPipeline, "image" | "audio" | "video"> = {
  image: "image",
  music: "audio",
  video: "video",
  voice: "audio",
};

async function raiseAlerts(
  session: OwnerSession,
  pipeline: MediaPipeline,
  attempts: { provider: string; label: string; reason?: string; message?: string }[]
) {
  const rows = attempts
    .filter((attempt) => attempt.reason === "quota" || attempt.reason === "missing_key")
    .map((attempt) => ({
      pipeline,
      provider: attempt.provider,
      reason: attempt.reason,
      message: attempt.message ?? `${attempt.label} is unavailable.`,
    }));
  if (rows.length === 0) return;
  await session.client.from("provider_alerts").insert(rows);
}

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { pipeline?: unknown; prompt?: unknown; options?: unknown; creditAction?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ error: "Send a JSON object." }, 400);
  }

  const pipeline = body.pipeline as MediaPipeline;
  if (!VALID_PIPELINES.includes(pipeline)) {
    return json({ error: "pipeline must be image, music, video, or voice." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "A prompt is required." }, 400);
  const promptCap = pipeline === "voice" ? MAX_VOICE_LENGTH : MAX_PROMPT_LENGTH;
  if (prompt.length > promptCap) {
    return json({ error: `Keep the prompt under ${promptCap} characters.` }, 413);
  }

  const rawOptions = (body.options ?? {}) as Record<string, unknown>;
  const options = {
    width: typeof rawOptions.width === "number" ? rawOptions.width : undefined,
    height: typeof rawOptions.height === "number" ? rawOptions.height : undefined,
    seed: typeof rawOptions.seed === "number" ? rawOptions.seed : undefined,
    model: typeof rawOptions.model === "string" && rawOptions.model ? rawOptions.model : undefined,
    durationSeconds:
      typeof rawOptions.durationSeconds === "number" ? rawOptions.durationSeconds : undefined,
    stability: typeof rawOptions.stability === "number" ? rawOptions.stability : undefined,
    similarityBoost:
      typeof rawOptions.similarityBoost === "number" ? rawOptions.similarityBoost : undefined,
  };

  // Reserve credits before spending a provider's quota — after the checks
  // above so a malformed request never costs anything. The charge is the hold:
  // success simply keeps it, and every failure below writes the compensating
  // refund, which is what /pricing promises under "On failure → Refund".
  //
  // The tier is derived server-side from the request itself: voice is metered
  // by script length (standard covers 500 characters, long covers 2500), and
  // every other pipeline charges its standard tier. A client-supplied
  // creditAction never lowers the price — it is only honored when it equals
  // the derived tier.
  const creditAction = resolveCreditAction(pipeline, body.creditAction, {
    scriptChars: prompt.length,
  });
  const holdRef = crypto.randomUUID();
  // Billing seconds are sanitized here and rounded (ceiling) inside
  // totalCredits, so a fractional or negative client value can never mint
  // fractional credits. The same value is passed to the provider, which is
  // the remaining — accepted — trust boundary on duration.
  const rawSeconds = options.durationSeconds;
  const billedSeconds =
    typeof rawSeconds === "number" && Number.isFinite(rawSeconds) && rawSeconds > 0
      ? rawSeconds
      : 0;
  // The owner (operator) runs free — the same rule chat and image edits already
  // follow — so using the app's own tools never drains the operator's balance.
  // Everyone else reserves the hold before spending a provider's quota.
  let charge: Awaited<ReturnType<typeof chargeCredits>> | null = null;
  if (!session.isOwner) {
    charge = await chargeCredits(session.client, creditAction, holdRef, billedSeconds);

    if (!charge.ok) {
      return json(
        {
          error: charge.message,
          status: charge.kind === "insufficient" ? "insufficient_credits" : "billing_unavailable",
          action: creditAction,
        },
        charge.kind === "insufficient" ? 402 : 503
      );
    }
  }

  let refund: { refunded: boolean; message?: string } = { refunded: true };
  const rollback = async () => {
    if (charge) refund = await refundCredits(session.client, holdRef);
  };

  let result;
  try {
    const { overrides } = await loadStoredKeys(session.client);
    const disabled = await loadDisabledProviders(session.client);
    result = await generateMedia(pipeline, prompt, options, overrides, disabled);
  } catch (error) {
    await rollback();
    const message = error instanceof Error ? error.message : "Generation failed.";
    return json(
      {
        error: message,
        status: "generation_failed",
        credits: { action: creditAction, cost: charge?.cost ?? 0, refunded: refund.refunded, note: refund.message },
      },
      500
    );
  }

  if (!result.ok) {
    await raiseAlerts(session, pipeline, result.attempts);
    await rollback();
    return json(
      {
        error:
          pipeline === "voice"
            ? "No speech provider is available right now."
            : `No free ${pipeline} provider is available right now.`,
        status: "quota_exhausted",
        guidance: result.guidance,
        attempts: result.attempts,
        credits: { action: creditAction, cost: charge?.cost ?? 0, refunded: refund.refunded, note: refund.message },
      },
      503
    );
  }

  const { media } = result;
  const assetId = crypto.randomUUID();
  const storagePath = `${session.userId}/${assetId}.${media.extension}`;

  const { error: uploadError } = await session.client.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, media.bytes, { contentType: media.contentType, upsert: false });

  if (uploadError) {
    await rollback();
    return json(
      {
        error: `Generated the ${pipeline}, but storing it failed: ${uploadError.message}. Confirm the "media" storage bucket and its owner policies exist (run the media migration).`,
        attempts: result.attempts,
        credits: { action: creditAction, cost: charge?.cost ?? 0, refunded: refund.refunded, note: refund.message },
      },
      502
    );
  }

  const { data: asset, error: insertError } = await session.client
    .from("media_assets")
    .insert({
      id: assetId,
      kind: KIND_BY_PIPELINE[pipeline],
      source: "generated",
      prompt,
      provider: media.provider,
      model: media.model,
      storage_path: storagePath,
      mime_type: media.contentType,
      size_bytes: media.bytes.byteLength,
      width: options.width ?? null,
      height: options.height ?? null,
      duration_seconds: options.durationSeconds ?? null,
    })
    .select("*")
    .single();

  if (insertError) {
    await session.client.storage.from(MEDIA_BUCKET).remove([storagePath]);
    await rollback();
    return json(
      {
        error: `Stored the file but could not index it: ${insertError.message}`,
        credits: { action: creditAction, cost: charge?.cost ?? 0, refunded: refund.refunded, note: refund.message },
      },
      502
    );
  }

  const { data: signed } = await session.client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 3600);

  return json({
    asset,
    signedUrl: signed?.signedUrl ?? null,
    attempts: result.attempts,
    credits: { action: creditAction, cost: charge?.cost ?? 0, balance: charge?.balance ?? null },
  });
}
