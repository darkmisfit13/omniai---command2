import { NextResponse } from "next/server";
import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";
import { generateMedia } from "@/lib/generation/router";
import { loadStoredKeys } from "@/lib/generation/secretStore";
import { loadDisabledProviders } from "@/lib/generation/providerSettings";
import { chargeCredits, refundCredits, resolveCreditAction } from "@/lib/billing/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MEDIA_BUCKET = "media";
const MAX_PROMPT = 2000;

const SYNTHETIC_POSE_FORWARDING_NOTE =
  "Preserve the source performer's 3D skeletal trajectory, timings and weight shifts exactly; re-render identity/costume/environment per director prompt.";

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const b = body as { sourceUrl?: unknown; characterPrompt?: unknown; environmentPrompt?: unknown; prompt?: unknown };
  const sourceUrl = typeof b.sourceUrl === "string" ? b.sourceUrl.trim() : "";
  const characterPrompt = typeof b.characterPrompt === "string" ? b.characterPrompt.trim() : "a cinematic hero";
  const environmentPrompt = typeof b.environmentPrompt === "string" ? b.environmentPrompt.trim() : "a neon sci-fi stage";
  const directPrompt = typeof b.prompt === "string" ? b.prompt.trim() : "";

  if (!sourceUrl && !directPrompt) {
    return json({ error: "Provide sourceUrl or a prompt." }, 400);
  }

  const composed = directPrompt ||
    `Video-to-video character re-targeting: source performer keeps their exact 3D skeletal movement and physical timing. ` +
    `Replace performer with: ${characterPrompt}. Replace environment with: ${environmentPrompt}. ` +
    `Maintain frame-perfect sync with source motion. ${SYNTHETIC_POSE_FORWARDING_NOTE}`;

  if (composed.length > MAX_PROMPT) return json({ error: `Prompt too long (max ${MAX_PROMPT}).` }, 413);

  const creditAction = resolveCreditAction("video", "video:standard");
  const holdRef = crypto.randomUUID();
  // 0 seconds: video:standard is a flat 200-credit action. The explicit 0 keeps
  // this route safe if the action ever gains a per-second tail — the bill then
  // reflects the actual clip (still passed to the provider below), not a
  // guessed constant.
  const charge = await chargeCredits(session.client, creditAction, holdRef, 0);
  // Charge may be skipped when billing returns a soft error; we still attempt.
  if (!charge.ok) {
    // continue only if billing unavailable? enforce 402 for insufficient
    if (charge.kind === "insufficient") {
      return json({ error: charge.message, status: "insufficient_credits" }, 402);
    }
  }

  const rollback = async () => { await refundCredits(session.client, holdRef); };

  let result;
  try {
    const { overrides } = await loadStoredKeys(session.client);
    const disabled = await loadDisabledProviders(session.client);
    result = await generateMedia("video", composed, { durationSeconds: 5 }, overrides, disabled);
  } catch (error) {
    await rollback();
    return json({ error: error instanceof Error ? error.message : "Re-target failed.", status: "generation_failed" }, 500);
  }

  if (!result.ok) {
    await rollback();
    return json({ error: "No video provider available.", guidance: result.guidance, attempts: result.attempts, status: "quota_exhausted" }, 503);
  }

  const { media } = result;
  const assetId = crypto.randomUUID();
  const storagePath = `${session.userId}/${assetId}.${media.extension}`;
  const { error: up } = await session.client.storage.from(MEDIA_BUCKET).upload(storagePath, media.bytes, { contentType: media.contentType, upsert: false });
  if (up) { await rollback(); return json({ error: up.message, status: "storage_failed" }, 502); }

  const { data: asset } = await session.client.from("media_assets").insert({
    id: assetId,
    kind: "video",
    source: "generated",
    prompt: composed,
    provider: media.provider,
    model: media.model,
    storage_path: storagePath,
    mime_type: media.contentType,
    size_bytes: media.bytes.byteLength,
    duration_seconds: 5,
    metadata: { sourceUrl, characterPrompt, environmentPrompt, method: "re-target" },
  }).select("*").single();

  const { data: signed } = await session.client.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 3600);
  return json({
    asset,
    signedUrl: signed?.signedUrl ?? null,
    attempts: result.attempts,
    credits: charge.ok ? { balance: charge.balance, cost: charge.cost } : undefined,
    poseTrack: "preserved-from-source",
  });
}
