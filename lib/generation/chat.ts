import {
  generationConfig,
  resolveEnvValue,
  resolveProviderKey,
  type KeyOverrides,
} from "./config";
import { ProviderError } from "./types";

/**
 * Server-side chat/text routing through the providers configured in
 * generation.json (the "chat" pipeline). Keys come from the server environment
 * or from the owner-saved encrypted store, so connecting a provider in
 * Admin -> AI Providers is all that is needed to make it live.
 *
 * Free-first: the pipeline order starts with free tiers (Gemini, Groq) and
 * ends with the local Ollama model, so a missing paid key is simply skipped.
 * Only sanitized metadata (provider id, model, latency) ever leaves here.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  provider: string;
  label: string;
  model: string;
  text: string;
  latencyMs: number;
}

export interface ChatAttempt {
  provider: string;
  label: string;
  ok: boolean;
  reason?: "missing_key" | "quota" | "error";
  message?: string;
}

const CHAT_TIMEOUT_MS = 45_000;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const LOVABLE_CHAT_BASE = "https://ai.gateway.lovable.dev/v1";

/** Fallback base URLs for OpenAI-compatible providers without an endpoint set. */
const OPENAI_COMPAT_BASES: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  xai: "https://api.x.ai/v1",
  perplexity: "https://api.perplexity.ai",
  moonshot: "https://api.moonshot.ai/v1",
  copilot: "https://api.githubcopilot.com/v1",
};

/** GitHub Copilot refuses anonymous-looking clients without editor metadata. */
const EXTRA_HEADERS: Record<string, Record<string, string>> = {
  copilot: {
    "Editor-Version": "vscode/1.95.0",
    "Editor-Plugin-Version": "copilot-chat/0.24.0",
  },
};

async function chatFetch(url: string, init: RequestInit, providerLabel: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(CHAT_TIMEOUT_MS) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network request failed";
    throw new ProviderError("error", `${providerLabel} could not be reached: ${message}`);
  }
}

function classifyChatStatus(status: number, label: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError("error", `${label} rejected the API key (HTTP ${status}).`, status);
  }
  if (status === 402 || status === 429) {
    return new ProviderError("quota", `${label} hit its rate limit or balance (HTTP ${status}).`, status);
  }
  return new ProviderError("error", `${label} returned HTTP ${status}.`, status);
}

/** Model for a provider: config default, with the per-provider env override honored. */
function modelFor(providerId: string, override?: string): string {
  if (override) return override;
  const configured = generationConfig.providers[providerId]?.models.text || "";
  // GROQ_MODEL is set by the Supabase edge functions too; keep it authoritative.
  if (providerId === "groq") return resolveEnvValue("GROQ_MODEL") || configured;
  return configured;
}

/* ------------------------------------------------------------------ */
/* Transports                                                          */
/* ------------------------------------------------------------------ */

async function openAiCompatibleChat(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  keys: KeyOverrides
): Promise<string> {
  const provider = generationConfig.providers[providerId];
  const providerLabel = provider?.label ?? providerId;
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", `${providerLabel} API key is not configured.`);

  const base = provider?.endpoint || OPENAI_COMPAT_BASES[providerId] || LOVABLE_CHAT_BASE;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    ...(EXTRA_HEADERS[providerId] ?? {}),
  };
  if (providerId === "lovable") headers["Lovable-API-Key"] = key;

  const response = await chatFetch(
    `${base.replace(/\/$/, "")}/chat/completions`,
    { method: "POST", headers, cache: "no-store", body: JSON.stringify({ model, messages }) },
    providerLabel
  );
  if (!response.ok) throw classifyChatStatus(response.status, providerLabel);

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new ProviderError("error", `${providerLabel} returned an empty response.`);
  return text;
}

async function anthropicChat(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  keys: KeyOverrides
): Promise<string> {
  const providerLabel = generationConfig.providers[providerId]?.label ?? providerId;
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", `${providerLabel} API key is not configured.`);

  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await chatFetch(
    `${ANTHROPIC_BASE}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        ...(system ? { system } : {}),
        messages: conversation,
      }),
    },
    providerLabel
  );
  if (!response.ok) throw classifyChatStatus(response.status, providerLabel);

  const payload = (await response.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
  };
  const text = payload?.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ProviderError("error", `${providerLabel} returned an empty response.`);
  return text;
}

async function geminiChat(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  keys: KeyOverrides
): Promise<string> {
  const providerLabel = generationConfig.providers[providerId]?.label ?? providerId;
  const key = resolveProviderKey(providerId, process.env, keys);
  if (!key) throw new ProviderError("missing_key", `${providerLabel} API key is not configured.`);

  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const response = await chatFetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      }),
    },
    providerLabel
  );
  if (!response.ok) throw classifyChatStatus(response.status, providerLabel);

  const payload = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ProviderError("error", `${providerLabel} returned an empty response.`);
  return text;
}

async function ollamaChat(
  providerId: string,
  messages: ChatMessage[],
  model: string
): Promise<string> {
  const providerLabel = generationConfig.providers[providerId]?.label ?? providerId;
  const base = resolveEnvValue("OLLAMA_BASE_URL");
  if (!base) {
    throw new ProviderError(
      "missing_key",
      "Ollama is not reachable from this deployment (OLLAMA_BASE_URL unset)."
    );
  }

  const response = await chatFetch(
    `${base.replace(/\/$/, "")}/v1/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ model, messages }),
    },
    providerLabel
  );
  if (!response.ok) throw classifyChatStatus(response.status, providerLabel);

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new ProviderError("error", `${providerLabel} returned an empty response.`);
  return text;
}

/* ------------------------------------------------------------------ */
/* Single provider + failover chain                                    */
/* ------------------------------------------------------------------ */

/** Run one chat completion against a single provider. */
export async function runChatProvider(
  providerId: string,
  messages: ChatMessage[],
  keys: KeyOverrides = {},
  modelOverride?: string
): Promise<ChatResult> {
  const provider = generationConfig.providers[providerId];
  if (!provider) throw new ProviderError("error", `Unknown provider "${providerId}".`);

  const model = modelFor(providerId, modelOverride);
  if (!model) throw new ProviderError("error", `${provider.label} has no text model configured.`);

  const started = Date.now();
  let text: string;
  switch (provider.transport) {
    case "chat_anthropic":
      text = await anthropicChat(providerId, messages, model, keys);
      break;
    case "chat_gemini":
      text = await geminiChat(providerId, messages, model, keys);
      break;
    case "chat_ollama":
      text = await ollamaChat(providerId, messages, model);
      break;
    case "chat_openai":
    case "lovable":
      text = await openAiCompatibleChat(providerId, messages, model, keys);
      break;
    default:
      throw new ProviderError("error", `${provider.label} is not a chat provider.`);
  }

  return { provider: providerId, label: provider.label, model, text, latencyMs: Date.now() - started };
}

/**
 * Run a chat completion walking the configured pipeline order until one
 * provider answers. Never throws for an individual provider failure; the
 * attempt list is returned so callers can surface what happened.
 */
export async function routeChat(
  messages: ChatMessage[],
  keys: KeyOverrides = {},
  options: { provider?: string; model?: string; disabled?: Set<string> } = {}
): Promise<{ result?: ChatResult; attempts: ChatAttempt[] }> {
  const attempts: ChatAttempt[] = [];
  const order = options.provider ? [options.provider] : generationConfig.pipelines.chat?.order ?? [];

  for (const providerId of order) {
    if (options.disabled?.has(providerId)) {
      attempts.push({
        provider: providerId,
        label: generationConfig.providers[providerId]?.label ?? providerId,
        ok: false,
        reason: "error",
        message: "Turned off in Admin -> AI Providers.",
      });
      continue;
    }
    try {
      const result = await runChatProvider(providerId, messages, keys, options.model);
      attempts.push({ provider: providerId, label: result.label, ok: true });
      return { result, attempts };
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : null;
      attempts.push({
        provider: providerId,
        label: generationConfig.providers[providerId]?.label ?? providerId,
        ok: false,
        reason: providerError?.kind ?? "error",
        message: error instanceof Error ? error.message : "Unknown chat error.",
      });
    }
  }

  return { attempts };
}
