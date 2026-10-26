import { InferenceClient } from "@huggingface/inference";
import {
  ProviderError,
  type GenerateOptions,
  type GeneratedMedia,
  type MediaPipeline,
} from "./types";
import { generationConfig, resolveEnvValue, resolveProviderKey, type KeyOverrides } from "./config";

/**
 * Upper bound a single provider is ever allowed to take, per pipeline. The generate
 * routes run with `maxDuration = 60` on Vercel, so anything larger than the function
 * budget just gets the whole request killed mid-request and loses every remaining
 * fallback — hence the separate, shorter attempt budget below.
 */
const PIPELINE_TIMEOUT_CEILING_MS: Record<MediaPipeline, number> = {
  image: 120_000,
  music: 180_000,
  video: 300_000,
};

/**
 * Default time one provider may consume. Leaves headroom for the next providers in
 * the pipeline to still be tried inside the 60s function budget, so a slow provider
 * fails over instead of taking the request down with it.
 */
const DEFAULT_ATTEMPT_BUDGET_MS = 45_000;

/**
 * Effective per-attempt budget. Override with OMNIAI_PROVIDER_TIMEOUT_MS when you
 * raise `maxDuration` on the generate routes (e.g. on a plan that allows 300s).
 */
function attemptBudgetMs(pipeline: MediaPipeline): number {
  const raw = Number(process.env.OMNIAI_PROVIDER_TIMEOUT_MS);
  const configured = Number.isFinite(raw) && raw >= 1_000 ? raw : DEFAULT_ATTEMPT_BUDGET_MS;
  return Math.min(PIPELINE_TIMEOUT_CEILING_MS[pipeline], configured);
}

const POLLINATIONS_IMAGE_BASE = "https://image.pollinations.ai/prompt";
const GOOGLE_GENERATIVE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CLOUDFLARE_BASE = "https://api.cloudflare.com/client/v4/accounts";
const DEFAULT_HF_ENDPOINT = "https://router.huggingface.co/hf-inference/models";
const DEFAULT_GEN_ENDPOINT = "https://gen.pollinations.ai";

const AIHORDE_BASE = "https://aihorde.net/api/v2";
/** AI Horde's well-known anonymous key: usable by anyone, queues behind registered users. */
const AIHORDE_ANON_KEY = "0000000000";
const AIHORDE_CLIENT_AGENT = "OmniAI:1.0:Darkmisfitstudios";
/** Without kudos the Horde refuses anything larger than this, or with more steps. */
const AIHORDE_ANON_MAX_SIDE = 576;
const AIHORDE_ANON_STEPS = 20;

const PIXAZO_GATEWAY = "https://gateway.pixazo.ai";
/** Free-tier text-to-image, synchronous (returns an `imageUrl`). */
const PIXAZO_IMAGE_PATH = "/sdxl_lightning/getImage/v1/getSDXLImage";
/** Async job endpoint shared by every queued Pixazo model. */
const PIXAZO_STATUS_PATH = "/v2/requests/status";

const FAL_QUEUE_BASE = "https://queue.fal.run";
const APIFRAME_BASE = "https://api.apiframe.ai/v2";
const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const ZSKY_BASE = "https://zsky.ai/api/v1";
/**
 * ZSky's edge rejects requests carrying a library default user agent with HTTP 403,
 * so every request must announce itself.
 */
const ZSKY_USER_AGENT = "OmniAI/1.0 (https://github.com/darkmisfit13/omniai)";
/** Every queued provider polls on this cadence before backing off. */
const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_INTERVAL_MS = 10_000;
/**
 * Wording providers use when an account has run out of credit. Status codes alone are
 * unreliable here — fal and APIFrame answer 402, Pixazo answers 403 — so the body is
 * checked too and the failure is raised as `quota` (which asks you to switch provider)
 * rather than as a generic error.
 */
const QUOTA_PHRASES = [
  "insufficient",
  "out of credit",
  "out of funds",
  "credit balance",
  "payment_required",
  "quota",
  "kudos",
];
/** Durations Pixazo's LTX tiers accept, in seconds. Anything else is rejected with a 400. */
const PIXAZO_VIDEO_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20];

function extensionFor(contentType: string, fallback: string): string {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("webm")) return "webm";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  return fallback;
}

function classifyStatus(status: number, providerLabel: string): ProviderError {
  if (status === 429) {
    return new ProviderError("quota", `${providerLabel} is rate limited right now (HTTP 429).`, status);
  }
  if (status === 402) {
    return new ProviderError("quota", `${providerLabel} reports its free quota is exhausted (HTTP 402).`, status);
  }
  if (status === 401) {
    return new ProviderError("error", `${providerLabel} rejected the API key (HTTP 401).`, status);
  }
  if (status === 403) {
    return new ProviderError("error", `${providerLabel} denied the request (HTTP 403). The key may be wrong or the model is gated.`, status);
  }
  return new ProviderError("error", `${providerLabel} failed with HTTP ${status}.`, status);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  providerLabel: string
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network request failed";
    throw new ProviderError("error", `${providerLabel} could not be reached: ${message}`);
  }
}

async function readBytes(response: Response, providerLabel: string): Promise<Uint8Array> {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new ProviderError("error", `${providerLabel} returned an empty response.`);
  }
  return new Uint8Array(buffer);
}

/* ------------------------------------------------------------------ */
/* Shared helpers for queued and URL-returning providers               */
/* ------------------------------------------------------------------ */

/** Rounds a requested size to a multiple of 64, which several providers require. */
function snapTo64(value: number | undefined, fallback: number): number {
  const clamped = Math.max(64, Math.min(4096, Math.round(value ?? fallback)));
  return Math.round(clamped / 64) * 64;
}

/** Picks the closest entry of a fixed list, used where an API accepts no free range. */
function snapToAllowed(value: number | undefined, allowed: number[], fallback: number): number {
  const target = value ?? fallback;
  let best = allowed[0] ?? fallback;
  for (const candidate of allowed) {
    if (Math.abs(candidate - target) < Math.abs(best - target)) best = candidate;
  }
  return best;
}

/**
 * Reads a JSON body and turns a non-OK status into a classified provider error.
 */
async function readJson<T>(response: Response, providerLabel: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    const detail = text.slice(0, 400);
    const error = classifyStatus(response.status, providerLabel);
    // Out-of-credit is reported with wildly different statuses (fal and APIFrame use 402,
    // Pixazo uses 403). Match the wording so an exhausted balance reads as "quota" and the
    // app tells you to switch provider, rather than looking like a broken request.
    if (error.kind !== "quota" && QUOTA_PHRASES.some((phrase) => detail.toLowerCase().includes(phrase))) {
      error.kind = "quota";
    }
    if (detail) error.message = `${error.message} ${detail}`;
    throw error;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError("error", `${providerLabel} returned a response that was not JSON.`);
  }
}

/**
 * Polls a queued job until it reaches a terminal state or the time budget runs out.
 * AI Horde, Pixazo, fal, APIFrame and ZSky all share this shape: submit returns an
 * id, and a status endpoint is read until the job finishes.
 */
async function pollFor<T>(
  providerLabel: string,
  budgetMs: number,
  probe: () => Promise<T>,
  isTerminal: (state: T) => boolean
): Promise<T> {
  const deadline = Date.now() + budgetMs;
  let interval = POLL_INTERVAL_MS;
  for (;;) {
    if (Date.now() >= deadline) {
      throw new ProviderError(
        "error",
        `${providerLabel} was still generating after ${Math.round(budgetMs / 1000)}s.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    const state = await probe();
    if (isTerminal(state)) return state;
    interval = Math.min(interval * 2, POLL_MAX_INTERVAL_MS);
  }
}

/**
 * Downloads the finished asset from a provider CDN. Most queued APIs hand back a
 * URL rather than bytes, so this is the shared tail of nearly every queued transport.
 */
async function downloadMedia(
  url: string,
  providerId: string,
  providerLabel: string,
  model: string,
  pipeline: MediaPipeline,
  timeoutMs: number,
  fallbackType: string
): Promise<GeneratedMedia> {
  const response = await fetchWithTimeout(
    url,
    { method: "GET", cache: "no-store", redirect: "follow" },
    timeoutMs,
    providerLabel
  );
  if (!response.ok) throw classifyStatus(response.status, providerLabel);

  const contentType = response.headers.get("content-type") || fallbackType;
  const bytes = await readBytes(response, providerLabel);
  const fallbackExt = pipeline === "image" ? "png" : pipeline === "music" ? "mp3" : "mp4";
  return {
    provider: providerId,
    model,
    bytes,
    contentType,
    extension: extensionFor(contentType, fallbackExt),
  };
}

/* ------------------------------------------------------------------ */
/* Pollinations keyless image (free, no key required)                  */
/* ------------------------------------------------------------------ */

async function pollinationsImage(
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const url = new URL(`${POLLINATIONS_IMAGE_BASE}/${encodeURIComponent(prompt)}`);
  url.searchParams.set("model", model || "flux");
  url.searchParams.set("width", String(options.width ?? 1024));
  url.searchParams.set("height", String(options.height ?? 1024));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  if (options.seed !== undefined) url.searchParams.set("seed", String(options.seed));
  const token = resolveProviderKey("pollinations_gen", process.env, keys);
  if (token) url.searchParams.set("token", token);

  const response = await fetchWithTimeout(
    url.toString(),
    { method: "GET", cache: "no-store", redirect: "follow" },
    attemptBudgetMs("image"),
    "Pollinations image"
  );

  if (!response.ok) throw classifyStatus(response.status, "Pollinations image");

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new ProviderError("error", `Pollinations image returned ${contentType} instead of an image.`);
  }
  const bytes = await readBytes(response, "Pollinations image");
  return {
    provider: "pollinations_image",
    model: model || "flux",
    bytes,
    contentType,
    extension: extensionFor(contentType, "jpg"),
  };
}

/* ------------------------------------------------------------------ */
/* Hugging Face Inference (free monthly credits)                       */
/* ------------------------------------------------------------------ */

async function huggingface(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const provider = generationConfig.providers[providerId];
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "Hugging Face key is not configured.");

  // Use the official Hugging Face router for image generation.
  // Leave the existing music and video request paths unchanged.
  if (pipeline === "image") {
    const client = new InferenceClient(key);

    try {
      const image = await client.textToImage(
        {
          model,
          inputs: prompt,
        },
        { outputType: "blob" }
      );

      const contentType = image.type || "image/png";
      const bytes = new Uint8Array(await image.arrayBuffer());

      return {
        provider: providerId,
        model,
        bytes,
        contentType,
        extension: extensionFor(contentType, "png"),
      };
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message.slice(0, 350)
          : "Unknown SDK error";

      const kind =
        /credit|quota|rate.?limit|too many requests|billing/i.test(detail)
          ? "quota"
          : "error";

      throw new ProviderError(
        kind,
        `Hugging Face image generation failed: ${detail}`
      );
    }
  }

  const endpoint = provider.endpoint ?? DEFAULT_HF_ENDPOINT;
  const url = `${endpoint.replace(/\/$/, "")}/${model}`;

  const parameters: Record<string, unknown> = {};

  if (options.durationSeconds) parameters.duration = options.durationSeconds;

  const body: Record<string, unknown> = { inputs: prompt };
  if (Object.keys(parameters).length > 0) body.parameters = parameters;

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/octet-stream",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    attemptBudgetMs(pipeline),
    "Hugging Face"
  );

  if (!response.ok) {
    // Hugging Face returns 503 with an "estimated_time" while a model loads.
    if (response.status === 503) {
      throw new ProviderError("error", "Hugging Face is still loading that model. Try again shortly.", 503);
    }
    throw classifyStatus(response.status, "Hugging Face");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const text = await response.text();
    throw new ProviderError("error", `Hugging Face returned JSON instead of media: ${text.slice(0, 160)}`);
  }

  const bytes = await readBytes(response, "Hugging Face");
  const fallbackExt = pipeline === "music" ? "wav" : "mp4";
  return {
    provider: providerId,
    model,
    bytes,
    contentType: contentType || "application/octet-stream",
    extension: extensionFor(contentType, fallbackExt),
  };
}

/* ------------------------------------------------------------------ */
/* Cloudflare Workers AI (free daily neurons)                          */
/* ------------------------------------------------------------------ */

function findBase64Image(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.startsWith("data:image")) return value.split(",")[1] ?? null;
    // Heuristic: long base64 blob.
    if (value.length > 512 && /^[A-Za-z0-9+/=]+$/.test(value)) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBase64Image(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findBase64Image(item);
      if (found) return found;
    }
  }
  return null;
}

async function cloudflare(
  providerId: string,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const provider = generationConfig.providers[providerId];
  const token = resolveProviderKey(providerId, process.env, keys);
  if (!token) throw new ProviderError("missing_key", "Cloudflare API token is not configured.");
  const account = resolveEnvValue(provider.accountEnv, process.env, keys);
  if (!account) {
    throw new ProviderError("missing_key", "Cloudflare account id is not configured.");
  }

  const url = `${CLOUDFLARE_BASE}/${account}/ai/run/${model}`;
  // Cloudflare FLUX.1 Schnell rejects width and height at the request root.
  const body: Record<string, unknown> = { prompt };

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    attemptBudgetMs("image"),
    "Cloudflare Workers AI"
  );

  if (!response.ok) {
    const detail = await response.text();
    const safeDetail = detail.slice(0, 600);
    throw new ProviderError(
      "error",
      `Cloudflare Workers AI failed with HTTP ${response.status}: ${safeDetail}`,
      response.status
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/")) {
    const bytes = await readBytes(response, "Cloudflare Workers AI");
    return {
      provider: providerId,
      model,
      bytes,
      contentType,
      extension: extensionFor(contentType, "jpg"),
    };
  }

  const payload = (await response.json()) as { result?: unknown; success?: boolean };
  const base64 = findBase64Image(payload.result);
  if (!base64) {
    throw new ProviderError("error", "Cloudflare Workers AI did not return an image.");
  }
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  return {
    provider: providerId,
    model,
    bytes,
    contentType: "image/png",
    extension: "png",
  };
}

/* ------------------------------------------------------------------ */
/* Google Gemini image (AI Studio free tier)                           */
/* ------------------------------------------------------------------ */

type GeminiPart = { inlineData?: { mimeType?: string; data?: string }; text?: string };

async function googleImage(
  providerId: string,
  prompt: string,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "Gemini API key is not configured.");

  const url = `${GOOGLE_GENERATIVE_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      cache: "no-store",
    },
    attemptBudgetMs("image"),
    "Gemini image"
  );

  if (!response.ok) {
    const detail = await response.text();

    if (response.status === 429) {
      let googleMessage = "";
      try {
        const parsed = JSON.parse(detail) as {
          error?: { message?: string };
        };
        googleMessage = parsed.error?.message ?? "";
      } catch {
        // Keep the standard message if Google's response isn't JSON.
      }

      throw new ProviderError(
        "quota",
        `Gemini image is rate limited right now (HTTP 429).${
          googleMessage ? ` Google says: ${googleMessage.slice(0, 500)}` : ""
        }`,
        429
      );
    }

    throw classifyStatus(response.status, "Gemini image");
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part) => part.inlineData?.data);
  if (!inline?.inlineData?.data) {
    throw new ProviderError("error", "Gemini did not return an image (no inlineData).");
  }

  const contentType = inline.inlineData.mimeType ?? "image/png";
  const bytes = new Uint8Array(Buffer.from(inline.inlineData.data, "base64"));
  return {
    provider: providerId,
    model,
    bytes,
    contentType,
    extension: extensionFor(contentType, "png"),
  };
}

/* ------------------------------------------------------------------ */
/* Pollinations gen (paid - Pollen credits; video + music live here)   */
/* ------------------------------------------------------------------ */

async function pollinationsGen(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const provider = generationConfig.providers[providerId];
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "Pollinations gen key is not configured.");

  const base = provider.endpoint ?? DEFAULT_GEN_ENDPOINT;
  const segment = pipeline === "music" ? "audio" : pipeline;
  const url = new URL(`${base.replace(/\/$/, "")}/${segment}/${encodeURIComponent(prompt)}`);
  url.searchParams.set("key", key);
  url.searchParams.set("model", model);
  if (pipeline === "image") {
    url.searchParams.set("width", String(options.width ?? 1024));
    url.searchParams.set("height", String(options.height ?? 1024));
  }
  if (pipeline === "video" && options.durationSeconds) {
    url.searchParams.set("duration", String(options.durationSeconds));
  }

  const response = await fetchWithTimeout(
    url.toString(),
    { method: "GET", cache: "no-store", redirect: "follow" },
    attemptBudgetMs(pipeline),
    "Pollinations gen"
  );

  if (!response.ok) throw classifyStatus(response.status, "Pollinations gen");

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const text = await response.text();
    throw new ProviderError("error", `Pollinations gen returned JSON instead of media: ${text.slice(0, 160)}`);
  }

  const bytes = await readBytes(response, "Pollinations gen");
  const fallbackExt = pipeline === "image" ? "jpg" : pipeline === "music" ? "mp3" : "mp4";
  return {
    provider: providerId,
    model,
    bytes,
    contentType: contentType || "application/octet-stream",
    extension: extensionFor(contentType, fallbackExt),
  };
}

/* ------------------------------------------------------------------ */
/* AI Horde (free, crowdsourced, works anonymously)                    */
/* ------------------------------------------------------------------ */

interface AiHordeCheck {
  done?: boolean;
  faulted?: boolean;
  error?: string;
}

interface AiHordeGeneration {
  img?: string;
  model?: string;
}

interface AiHordeStatus {
  generations?: AiHordeGeneration[];
}

async function aihordeImage(
  providerId: string,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "AI Horde";
  // Falls back to the shared anonymous key, so the provider works with no setup at all.
  const key = resolveProviderKey(providerId, process.env, keys) || AIHORDE_ANON_KEY;
  const headers = {
    apikey: key,
    "Client-Agent": AIHORDE_CLIENT_AGENT,
    "Content-Type": "application/json",
  };
  const budget = attemptBudgetMs("image");
  // "auto" leaves the model unset so any idle worker can take the job; naming a model
  // usually means a much longer queue wait.
  const requestedModel = model && model !== "auto" ? model : "";

  // Anonymous requests hold no kudos, and the Horde refuses work over 576px a side
  // (or past its sampler work budget) without them. A registered key starts with kudos
  // and gets the full requested size, so only the keyless path is capped.
  const anonymous = !resolveProviderKey(providerId, process.env, keys);
  const limit = (value: number | undefined, fallback: number) => {
    const snapped = snapTo64(value, fallback);
    return anonymous ? Math.min(AIHORDE_ANON_MAX_SIDE, snapped) : snapped;
  };

  const submit = await fetchWithTimeout(
    `${AIHORDE_BASE}/generate/async`,
    {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        prompt,
        nsfw: false,
        r2: true,
        slow_workers: true,
        replacement_filter: true,
        ...(requestedModel ? { models: [requestedModel] } : {}),
        params: {
          sampler_name: "k_euler",
          karras: true,
          steps: anonymous ? AIHORDE_ANON_STEPS : 30,
          n: 1,
          width: limit(options.width, 512),
          height: limit(options.height, 512),
        },
      }),
    },
    budget,
    label
  );

  if (submit.status === 403 && (await submit.text()).includes("KudosUpfront")) {
    throw new ProviderError(
      "quota",
      `${label} needs kudos for a request this large. Register free at aihorde.net to get a key (new accounts start with kudos), or generate at ${AIHORDE_ANON_MAX_SIDE}x${AIHORDE_ANON_MAX_SIDE} or smaller.`,
      403
    );
  }

  const accepted = await readJson<{ id?: string; error?: string; message?: string }>(submit, label);
  if (!accepted.id) {
    throw new ProviderError(
      "error",
      `${label} did not accept the request: ${accepted.error ?? accepted.message ?? "no job id"}.`
    );
  }
  const requestId = accepted.id;

  const check = await pollFor<AiHordeCheck>(
    label,
    budget,
    async () => {
      const response = await fetchWithTimeout(
        `${AIHORDE_BASE}/generate/check/${requestId}`,
        { headers, cache: "no-store" },
        budget,
        label
      );
      return readJson<AiHordeCheck>(response, label);
    },
    (state) => Boolean(state.done) || Boolean(state.faulted)
  );
  if (check.faulted) {
    throw new ProviderError("error", `${label} faulted: ${check.error ?? "the job failed on a worker."}`);
  }

  const statusResponse = await fetchWithTimeout(
    `${AIHORDE_BASE}/generate/status/${requestId}`,
    { headers, cache: "no-store" },
    budget,
    label
  );
  const status = await readJson<AiHordeStatus>(statusResponse, label);
  const generation = status.generations?.[0];
  const source = generation?.img;
  if (!source) throw new ProviderError("error", `${label} finished but returned no image.`);

  const resolvedModel = generation?.model || model;
  if (source.startsWith("http")) {
    return downloadMedia(source, providerId, label, resolvedModel, "image", budget, "image/png");
  }
  const bytes = new Uint8Array(Buffer.from(source, "base64"));
  return {
    provider: providerId,
    model: resolvedModel,
    bytes,
    contentType: "image/png",
    extension: "png",
  };
}

/* ------------------------------------------------------------------ */
/* Puter.js (free, no API key - paid for by the signed-in Puter user)  */
/* ------------------------------------------------------------------ */

interface PuterClient {
  init: (config: { auth_token: string }) => void;
  ai: {
    txt2img: (prompt: string, options?: Record<string, unknown>) => Promise<{ src?: string }>;
  };
}

let puterPromise: Promise<PuterClient> | null = null;

/**
 * Puter is a browser-first SDK that also supports Node, where `txt2img` resolves to an
 * object whose `src` carries a URL or a data URI. Imported lazily so the dependency is
 * only loaded when a Puter request actually runs.
 */
async function loadPuter(): Promise<PuterClient> {
  if (!puterPromise) {
    puterPromise = import("@heyputer/puter.js").then((raw) => {
      const mod = raw as unknown as { default?: PuterClient } & PuterClient;
      const puter = mod.default ?? mod;
      if (!puter?.ai?.txt2img) {
        throw new ProviderError("error", "The Puter SDK did not expose ai.txt2img.");
      }
      return puter;
    });
  }
  return puterPromise;
}

/** Maps Puter's `{ message, code, errorCode }` failures onto our failure kinds. */
function puterError(error: unknown, providerLabel: string): ProviderError {
  const body = (error ?? {}) as { code?: string; errorCode?: string; message?: string };
  const code = body.errorCode ?? body.code ?? "";
  const message = body.message ?? (error instanceof Error ? error.message : "");
  if (code === "insufficient_funds") {
    return new ProviderError("quota", `${providerLabel} is out of credits (HTTP 402).`, 402);
  }
  const suffix = message ? `: ${message.slice(0, 300)}` : ".";
  return new ProviderError("error", `${providerLabel} failed${code ? ` (${code})` : ""}${suffix}`);
}

async function puterImage(
  providerId: string,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "Puter.js";
  const token = resolveProviderKey(providerId, process.env, keys);
  if (!token) throw new ProviderError("missing_key", "Puter auth token is not configured.");

  const puter = await loadPuter();
  puter.init({ auth_token: token });

  const requestOptions: Record<string, unknown> = {};
  if (options.width && options.height) {
    requestOptions.width = options.width;
    requestOptions.height = options.height;
  }
  if (model && model !== "auto") requestOptions.model = model;

  let image: { src?: string };
  try {
    image = await puter.ai.txt2img(prompt, requestOptions);
  } catch (error) {
    throw puterError(error, label);
  }

  const src = typeof image?.src === "string" ? image.src : "";
  if (!src) throw new ProviderError("error", `${label} returned no image source.`);

  if (src.startsWith("data:")) {
    const header = src.slice(0, src.indexOf(","));
    const payload = src.slice(src.indexOf(",") + 1);
    const contentType = /^data:([^;,]+)/.exec(header)?.[1] ?? "image/png";
    const bytes = new Uint8Array(Buffer.from(payload, "base64"));
    return {
      provider: providerId,
      model,
      bytes,
      contentType,
      extension: extensionFor(contentType, "png"),
    };
  }

  return downloadMedia(src, providerId, label, model, "image", attemptBudgetMs("image"), "image/png");
}

/* ------------------------------------------------------------------ */
/* Pixazo (sync image, queued video and music)                         */
/* ------------------------------------------------------------------ */

interface PixazoStatus {
  status?: string;
  error?: string | null;
  output?: { media_url?: string[]; media_type?: string } | null;
}

async function pixazo(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "Pixazo";
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "Pixazo API key is not configured.");

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Ocp-Apim-Subscription-Key": key,
  };
  const budget = attemptBudgetMs(pipeline);

  // Images use the free-tier endpoint, which answers synchronously with a URL.
  if (pipeline === "image") {
    const response = await fetchWithTimeout(
      `${PIXAZO_GATEWAY}${PIXAZO_IMAGE_PATH}`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          prompt,
          width: options.width ?? 1024,
          height: options.height ?? 1024,
          ...(options.seed !== undefined ? { seed: options.seed } : {}),
        }),
      },
      budget,
      label
    );
    const payload = await readJson<{
      imageUrl?: string;
      output?: string;
      error?: string;
      message?: string;
    }>(response, label);
    const url = payload.imageUrl || payload.output;
    if (!url) {
      throw new ProviderError(
        "error",
        `${label} did not return an image URL${payload.error ? `: ${payload.error}` : "."}`
      );
    }
    return downloadMedia(url, providerId, label, model, "image", budget, "image/webp");
  }

  const endpoint =
    pipeline === "music"
      ? `${PIXAZO_GATEWAY}/tracks/v1/generate`
      : `${PIXAZO_GATEWAY}/${model}/v1/text-to-video`;

  const body: Record<string, unknown> = { prompt };
  if (pipeline === "music") {
    body.duration = Math.max(10, Math.min(600, Math.round(options.durationSeconds ?? 30)));
    body.instrumental = true;
  } else {
    body.resolution = "720p";
    body.duration = snapToAllowed(options.durationSeconds, PIXAZO_VIDEO_DURATIONS, 6);
  }

  const submitResponse = await fetchWithTimeout(
    endpoint,
    { method: "POST", headers, cache: "no-store", body: JSON.stringify(body) },
    budget,
    label
  );
  const submitted = await readJson<{ request_id?: string; error?: string; message?: string }>(
    submitResponse,
    label
  );
  if (!submitted.request_id) {
    throw new ProviderError(
      "error",
      `${label} did not queue the job: ${submitted.error ?? submitted.message ?? "no request id"}.`
    );
  }
  const requestId = submitted.request_id;

  const finished = await pollFor<PixazoStatus>(
    label,
    budget,
    async () => {
      const response = await fetchWithTimeout(
        `${PIXAZO_GATEWAY}${PIXAZO_STATUS_PATH}/${requestId}`,
        { headers, cache: "no-store" },
        budget,
        label
      );
      return readJson<PixazoStatus>(response, label);
    },
    (state) =>
      state.status === "COMPLETED" || state.status === "FAILED" || state.status === "ERROR"
  );

  const url = finished.output?.media_url?.[0];
  if (finished.status !== "COMPLETED" || !url) {
    throw new ProviderError(
      "error",
      `${label} failed: ${finished.error ?? finished.status ?? "no output"}.`
    );
  }
  return downloadMedia(
    url,
    providerId,
    label,
    model,
    pipeline,
    budget,
    pipeline === "music" ? "audio/wav" : "video/mp4"
  );
}

/* ------------------------------------------------------------------ */
/* fal.ai (queue API, image and video)                                 */
/* ------------------------------------------------------------------ */

interface FalSubmit {
  request_id?: string;
  status_url?: string;
  response_url?: string;
  error?: unknown;
}

interface FalStatus {
  status?: string;
  error?: unknown;
}

interface FalResult {
  images?: { url?: string }[];
  image?: { url?: string };
  video?: string | { url?: string };
  video_url?: string;
  audio_url?: string;
}

async function fal(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "fal.ai";
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "FAL_KEY is not configured.");

  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const budget = attemptBudgetMs(pipeline);

  const body: Record<string, unknown> = { prompt };
  // Only image models accept image_size; video models reject unknown fields.
  if (pipeline === "image") {
    body.image_size = { width: options.width ?? 1024, height: options.height ?? 1024 };
  }
  if (pipeline === "video" && options.durationSeconds) {
    body.duration = options.durationSeconds;
  }

  const submitResponse = await fetchWithTimeout(
    `${FAL_QUEUE_BASE}/${model}`,
    { method: "POST", headers, cache: "no-store", body: JSON.stringify(body) },
    budget,
    label
  );
  const submitted = await readJson<FalSubmit>(submitResponse, label);
  if (!submitted.status_url || !submitted.response_url) {
    throw new ProviderError("error", `${label} did not return a queue handle.`);
  }
  const statusUrl = submitted.status_url;
  const responseUrl = submitted.response_url;

  const finished = await pollFor<FalStatus>(
    label,
    budget,
    async () => {
      const response = await fetchWithTimeout(statusUrl, { headers, cache: "no-store" }, budget, label);
      return readJson<FalStatus>(response, label);
    },
    (state) => state.status === "COMPLETED"
  );
  if (finished.error) {
    throw new ProviderError("error", `${label} failed: ${String(finished.error).slice(0, 300)}.`);
  }

  const resultResponse = await fetchWithTimeout(
    responseUrl,
    { headers, cache: "no-store" },
    budget,
    label
  );
  const result = await readJson<FalResult>(resultResponse, label);
  const url =
    result.images?.[0]?.url ||
    result.image?.url ||
    (typeof result.video === "string" ? result.video : result.video?.url) ||
    result.video_url ||
    result.audio_url;
  if (!url) throw new ProviderError("error", `${label} returned no media URL.`);

  const fallbackType =
    pipeline === "image" ? "image/png" : pipeline === "music" ? "audio/mpeg" : "video/mp4";
  return downloadMedia(url, providerId, label, model, pipeline, budget, fallbackType);
}

/* ------------------------------------------------------------------ */
/* APIFrame (one key for image, video and music)                       */
/* ------------------------------------------------------------------ */

interface ApiFrameJob {
  status?: string;
  error?: string;
  result?: {
    images?: (string | { url?: string })[];
    videoUrl?: string;
    audioUrl?: string;
    tracks?: (string | { url?: string })[];
    gridUrl?: string;
  };
}

/** Normalises the `string | { url }` shapes several providers return. */
function firstUrl(values?: (string | { url?: string })[]): string | undefined {
  const first = values?.[0];
  if (typeof first === "string") return first;
  return first?.url;
}

async function apiframe(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  _options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "APIFrame";
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "APIFrame API key is not configured.");

  const headers = { "X-API-Key": key, "Content-Type": "application/json" };
  const budget = attemptBudgetMs(pipeline);
  const segment = pipeline === "image" ? "images" : pipeline === "music" ? "music" : "videos";

  const submitResponse = await fetchWithTimeout(
    `${APIFRAME_BASE}/${segment}/generate`,
    { method: "POST", headers, cache: "no-store", body: JSON.stringify({ prompt, model }) },
    budget,
    label
  );
  const submitted = await readJson<{ jobId?: string; error?: string }>(submitResponse, label);
  if (!submitted.jobId) {
    throw new ProviderError(
      "error",
      `${label} did not accept the request${submitted.error ? `: ${submitted.error}` : "."}`
    );
  }
  const jobId = submitted.jobId;

  const finished = await pollFor<ApiFrameJob>(
    label,
    budget,
    async () => {
      const response = await fetchWithTimeout(
        `${APIFRAME_BASE}/jobs/${jobId}`,
        { headers, cache: "no-store" },
        budget,
        label
      );
      return readJson<ApiFrameJob>(response, label);
    },
    (state) => state.status === "COMPLETED" || state.status === "FAILED"
  );

  if (finished.status !== "COMPLETED") {
    throw new ProviderError("error", `${label} failed${finished.error ? `: ${finished.error}` : "."}`);
  }

  const url =
    firstUrl(finished.result?.images) ||
    firstUrl(finished.result?.tracks) ||
    finished.result?.videoUrl ||
    finished.result?.audioUrl;
  if (!url) throw new ProviderError("error", `${label} returned no media URL.`);

  const fallbackType =
    pipeline === "image" ? "image/png" : pipeline === "music" ? "audio/mpeg" : "video/mp4";
  return downloadMedia(url, providerId, label, model, pipeline, budget, fallbackType);
}

/* ------------------------------------------------------------------ */
/* ElevenLabs (studio-grade music, synchronous)                        */
/* ------------------------------------------------------------------ */

async function elevenLabsMusic(
  providerId: string,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "ElevenLabs";
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "ElevenLabs API key is not configured.");

  const lengthMs = Math.max(3_000, Math.min(600_000, Math.round((options.durationSeconds ?? 30) * 1000)));
  const response = await fetchWithTimeout(
    `${ELEVENLABS_BASE}/music?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ prompt, music_length_ms: lengthMs, model_id: model }),
    },
    attemptBudgetMs("music"),
    label
  );
  if (!response.ok) throw classifyStatus(response.status, label);

  const bytes = await readBytes(response, label);
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  return {
    provider: providerId,
    model,
    bytes,
    contentType,
    extension: extensionFor(contentType, "mp3"),
  };
}

/* ------------------------------------------------------------------ */
/* ZSky (queued image and video)                                       */
/* ------------------------------------------------------------------ */

interface ZSkyJob {
  status?: string;
  result_url?: string;
  error?: string;
}

async function zsky(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions,
  model: string,
  keys: KeyOverrides
): Promise<GeneratedMedia> {
  const label = "ZSky";
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", "ZSky API key is not configured.");

  // ZSky's edge refuses requests sent with a library's default user agent (HTTP 403).
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": ZSKY_USER_AGENT,
    "X-API-Key": key,
  };
  const budget = attemptBudgetMs(pipeline);

  const body: Record<string, unknown> = { prompt };
  if (pipeline === "image") {
    body.width = options.width ?? 1024;
    body.height = options.height ?? 1024;
    if (options.seed !== undefined) body.seed = options.seed;
  } else {
    body.duration = Math.max(1, Math.min(10, options.durationSeconds ?? 5));
    body.mode = ["fast", "quality", "cinema"].includes(model) ? model : "fast";
  }

  const submitResponse = await fetchWithTimeout(
    `${ZSKY_BASE}/${pipeline === "image" ? "images" : "videos"}/generate`,
    { method: "POST", headers, cache: "no-store", body: JSON.stringify(body) },
    budget,
    label
  );
  const submitted = await readJson<{ job_id?: string; error?: string; message?: string }>(
    submitResponse,
    label
  );
  if (!submitted.job_id) {
    const paidOut = submitted.error === "payment_required";
    throw new ProviderError(
      "error",
      `${label} did not accept the request${submitted.error ? `: ${submitted.error}` : "."}${
        paidOut ? " ZSky's API needs a prepaid balance or a Pro/Max plan." : ""
      }`
    );
  }
  const jobId = submitted.job_id;

  const finished = await pollFor<ZSkyJob>(
    label,
    budget,
    async () => {
      const response = await fetchWithTimeout(
        `${ZSKY_BASE}/jobs/${jobId}`,
        { headers, cache: "no-store" },
        budget,
        label
      );
      return readJson<ZSkyJob>(response, label);
    },
    (state) => state.status === "completed" || state.status === "failed" || state.status === "blocked"
  );

  if (finished.status !== "completed" || !finished.result_url) {
    throw new ProviderError("error", `${label} failed: ${finished.error ?? finished.status ?? "no output"}.`);
  }

  const fallbackType = pipeline === "image" ? "image/webp" : "video/mp4";
  return downloadMedia(finished.result_url, providerId, label, model, pipeline, budget, fallbackType);
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export async function runProvider(
  providerId: string,
  pipeline: MediaPipeline,
  prompt: string,
  options: GenerateOptions,
  keys: KeyOverrides = {}
): Promise<GeneratedMedia> {
  const provider = generationConfig.providers[providerId];
  if (!provider) {
    throw new ProviderError("error", `Unknown provider "${providerId}".`);
  }
  if (provider.keyRequired && !resolveProviderKey(providerId, process.env, keys)) {
    throw new ProviderError("missing_key", `${provider.label} needs its API key configured.`);
  }

  const model = options.model || provider.models[pipeline] || "";
  if (!model) {
    throw new ProviderError("error", `${provider.label} has no model configured for ${pipeline}.`);
  }

  switch (provider.transport) {
    case "pollinations_image":
      return pollinationsImage(prompt, options, model, keys);
    case "huggingface":
      return huggingface(providerId, pipeline, prompt, options, model, keys);
    case "cloudflare":
      return cloudflare(providerId, prompt, options, model, keys);
    case "google_image":
      return googleImage(providerId, prompt, model, keys);
    case "pollinations_gen":
      return pollinationsGen(providerId, pipeline, prompt, options, model, keys);
    case "aihorde":
      return aihordeImage(providerId, prompt, options, model, keys);
    case "puter":
      return puterImage(providerId, prompt, options, model, keys);
    case "pixazo":
      return pixazo(providerId, pipeline, prompt, options, model, keys);
    case "fal":
      return fal(providerId, pipeline, prompt, options, model, keys);
    case "apiframe":
      return apiframe(providerId, pipeline, prompt, options, model, keys);
    case "elevenlabs":
      return elevenLabsMusic(providerId, prompt, options, model, keys);
    case "zsky":
      return zsky(providerId, pipeline, prompt, options, model, keys);
    default:
      throw new ProviderError("error", `${provider.label} cannot generate ${pipeline}.`);
  }
}





