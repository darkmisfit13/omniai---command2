import { authorizeUser, isUserSession, json, type UserSession } from "@/lib/generation/serverAuth";
import { loadStoredKeys } from "@/lib/generation/secretStore";
import { loadDisabledProviders } from "@/lib/generation/providerSettings";
import { chargeCredits, refundCredits } from "@/lib/billing/credits";
import { resolveProviderKey } from "@/lib/generation/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/image-edit
 * Body: { image: dataUrl, prompt }
 *
 * Reference-image edit (img2img) used by Image Studio's AI Auto Erase and any
 * other canvas-driven AI edit. The client composites its brush mask onto the
 * image before sending, so the model sees exactly which region to work on.
 *
 * Transport: the Lovable AI Gateway chat-completions image modality (the same
 * path the legacy hub-ai app used for editImageAsset) with
 * google/gemini-3.1-flash-image. The key comes from the server env or the
 * owner-saved store, so connecting Lovable in Admin -> AI Providers is all
 * that is needed to light this up.
 *
 * Billing: the owner runs free; every other signed-in account is charged the
 * image_edit:standard rate and refunded automatically if the edit fails.
 */

const MAX_IMAGE_CHARS = 5_500_000; // base64 payload cap (Vercel body limit headroom)
const MAX_PROMPT_LENGTH = 2000;
const EDIT_TIMEOUT_MS = 45_000;
const RESULT_FETCH_TIMEOUT_MS = 20_000;
const MAX_INLINE_BYTES = 3_200_000; // beyond this the result goes to storage instead
const MAX_RESULT_BYTES = 15_000_000;
const MEDIA_BUCKET = "media";

const LOVABLE_BASE = "https://ai.gateway.lovable.dev";
const EDIT_MODEL = "google/gemini-3.1-flash-image";
const DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;

const CHANNEL_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function extensionForMime(mime: string): string {
  return CHANNEL_EXT[mime] ?? "png";
}

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { image?: unknown; prompt?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ error: "Send a JSON object with image and prompt." }, 400);
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (!DATA_URL_PATTERN.test(image) || image.length > MAX_IMAGE_CHARS) {
    return json({ error: "image must be a base64 data URL of at most ~4 MB." }, 413);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "Describe what to change in the image." }, 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: `Keep the prompt under ${MAX_PROMPT_LENGTH} characters.` }, 413);
  }

  // Fail fast on missing/switched-off providers BEFORE charging, so a broken
  // connection never touches the ledger.
  const client = session.client;
  const { overrides } = await loadStoredKeys(client);
  const disabled = await loadDisabledProviders(client);

  if (disabled.has("lovable")) {
    return json(
      {
        error: "The image-edit provider is switched off.",
        status: "provider_unavailable",
        guidance: "Enable Lovable AI in Admin -> AI Providers to run AI image edits.",
      },
      503
    );
  }

  const key = resolveProviderKey("lovable", process.env, overrides);
  if (!key) {
    return json(
      {
        error: "No image-edit provider is connected.",
        status: "provider_unavailable",
        guidance:
          "Connect the Lovable AI Gateway key (LOVABLE_API_KEY) in Admin -> AI Providers — it powers AI object removal and reference edits.",
      },
      503
    );
  }

  // Reserve the edit credit. The charge is the hold: success keeps it, every
  // failure path below writes the compensating refund.
  const holdRef = crypto.randomUUID();
  let charge: Awaited<ReturnType<typeof chargeCredits>> | null = null;
  if (!session.isOwner) {
    charge = await chargeCredits(client, "image_edit:standard", holdRef);
    if (!charge.ok && charge.kind === "insufficient") {
      return json({ error: charge.message, status: "insufficient_credits" }, 402);
    }
    if (!charge.ok) charge = null; // billing unavailable — run uncharged
  }

  async function fail(status: number, payload: Record<string, unknown>) {
    if (charge) await refundCredits(client, holdRef);
    return json(payload, status);
  }

  const startedAt = Date.now();

  // Reference-image edit through the Lovable gateway (image modality).
  let upstream: Response;
  try {
    upstream = await fetch(`${LOVABLE_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(EDIT_TIMEOUT_MS),
      body: JSON.stringify({
        model: EDIT_MODEL,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network request failed";
    return fail(502, {
      error: `The image edit provider could not be reached: ${message}`,
      status: "generation_failed",
    });
  }

  if (!upstream.ok) {
    const excerpt = (await upstream.text().catch(() => "")).slice(0, 300);
    if (upstream.status === 401 || upstream.status === 403) {
      return fail(503, {
        error: "The image-edit provider rejected the API key (HTTP " + upstream.status + ").",
        status: "provider_unavailable",
        guidance: "Paste a fresh Lovable AI Gateway key in Admin -> AI Providers.",
        upstream: excerpt || undefined,
      });
    }
    if (upstream.status === 402 || upstream.status === 429) {
      return fail(503, {
        error: "The image-edit provider is out of credit or rate limited (HTTP " + upstream.status + ").",
        status: "quota_exhausted",
        guidance: "Top up the Lovable AI balance, or pause it in Admin -> AI Providers.",
        upstream: excerpt || undefined,
      });
    }
    return fail(502, {
      error: `The image-edit provider returned HTTP ${upstream.status}.`,
      status: "generation_failed",
      upstream: excerpt || undefined,
    });
  }

  const payload = (await upstream.json().catch(() => null)) as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[]; content?: string } }[];
  };
  const resultUrl = payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!resultUrl) {
    return fail(502, {
      error: "The provider returned no edited image. Try again — rewording the request sometimes helps.",
      status: "generation_failed",
      attempts: [{ provider: "lovable", label: "Lovable AI Gateway", ok: false, reason: "error" }],
    });
  }

  // Resolve the result to bytes server-side so the browser never fights CORS
  // when drawing it back onto the editor canvas.
  let bytes: Buffer;
  let mime = "image/png";
  try {
    if (resultUrl.startsWith("data:")) {
      const comma = resultUrl.indexOf(",");
      const meta = resultUrl.slice(5, comma).replace(/;base64$/i, "");
      if (/^image\/[a-z0-9.+-]+$/i.test(meta)) mime = meta;
      bytes = Buffer.from(resultUrl.slice(comma + 1), "base64");
    } else {
      const fetched = await fetch(resultUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(RESULT_FETCH_TIMEOUT_MS),
      });
      if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
      const contentType = fetched.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (/^image\/[a-z0-9.+-]+$/i.test(contentType)) mime = contentType;
      bytes = Buffer.from(await fetched.arrayBuffer());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "download failed";
    return fail(502, {
      error: `The edited image could not be downloaded: ${message}`,
      status: "generation_failed",
    });
  }

  if (bytes.byteLength === 0) {
    return fail(502, { error: "The provider returned an empty image.", status: "generation_failed" });
  }
  if (bytes.byteLength > MAX_RESULT_BYTES) {
    return fail(502, { error: "The edited image was too large to process.", status: "generation_failed" });
  }

  // Small results ride back inline as a data URL (no CORS, undo-friendly);
  // oversized ones go to the media bucket and come back as a signed URL.
  if (bytes.byteLength <= MAX_INLINE_BYTES) {
    return json({
      imageDataUrl: `data:${mime};base64,${bytes.toString("base64")}`,
      provider: "lovable",
      model: EDIT_MODEL,
      latencyMs: Date.now() - startedAt,
      credits: charge
        ? { action: "image_edit:standard", cost: charge.cost, balance: charge.balance }
        : { action: "image_edit:standard", cost: 0 },
    });
  }

  const assetId = crypto.randomUUID();
  const storagePath = `${session.userId}/${assetId}.${extensionForMime(mime)}`;
  const { error: uploadError } = await session.client.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    return fail(502, {
      error: `The edit succeeded but storing it failed: ${uploadError.message}. Confirm the "media" storage bucket exists (run the media migration).`,
      status: "generation_failed",
    });
  }
  const { data: signed, error: signError } = await session.client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (signError || !signed?.signedUrl) {
    await session.client.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return fail(502, {
      error: `The edit succeeded but its share link could not be created: ${signError?.message ?? "unknown error"}.`,
      status: "generation_failed",
    });
  }

  return json({
    signedUrl: signed.signedUrl,
    provider: "lovable",
    model: EDIT_MODEL,
    latencyMs: Date.now() - startedAt,
    credits: charge
      ? { action: "image_edit:standard", cost: charge.cost, balance: charge.balance }
      : { action: "image_edit:standard", cost: 0 },
  });
}
