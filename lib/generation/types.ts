export type MediaPipeline = "image" | "music" | "video" | "voice";

export type ProviderTransport =
  | "pollinations_image"
  | "pollinations_gen"
  | "huggingface"
  | "cloudflare"
  | "google_image"
  | "aihorde"
  | "puter"
  | "pixazo"
  | "fal"
  | "apiframe"
  | "elevenlabs"
  | "lovable"
  | "zsky"
  | "chat_openai"
  | "chat_anthropic"
  | "chat_gemini"
  | "chat_ollama"
  | "none";

export type ProviderFailureReason = "missing_key" | "quota" | "error";

export interface ProviderDefinition {
  label: string;
  transport: ProviderTransport;
  keyEnv?: string | null;
  keyEnvAlt?: string[];
  accountEnv?: string;
  /** Env var holding a base URL override (e.g. OLLAMA_BASE_URL for local_ollama). */
  endpointEnv?: string;
  keyRequired: boolean;
  free?: boolean;
  endpoint?: string;
  docs?: string;
  models: Partial<Record<MediaPipeline | "text", string>>;
}

export interface PipelineDefinition {
  order: string[];
  allow_local_fallback: boolean;
  quota_behavior?: "notify_switch_provider" | "graceful_pause";
}

export interface GenerationConfig {
  version: number;
  project_name: string;
  brand: string;
  system_guards: { max_system_ram_pct: number; prevent_oom_crash: boolean };
  pipelines: Record<string, PipelineDefinition>;
  providers: Record<string, ProviderDefinition>;
}

export interface GenerateOptions {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  durationSeconds?: number;
  /** Speech synthesis (voice pipeline): 0-1 ElevenLabs stability. */
  stability?: number;
  /** Speech synthesis (voice pipeline): 0-1 similarity boost. */
  similarityBoost?: number;
}

/** Raw media returned by a provider, before it is stored. */
export interface GeneratedMedia {
  provider: string;
  model: string;
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}

export interface ProviderAttempt {
  provider: string;
  label: string;
  ok: boolean;
  reason?: ProviderFailureReason;
  status?: number;
  message?: string;
}

export type GenerationResult =
  | { ok: true; media: GeneratedMedia; attempts: ProviderAttempt[] }
  | { ok: false; attempts: ProviderAttempt[]; exhausted: true; guidance: string };

/** Thrown by individual providers so the router can classify the failure. */
export class ProviderError extends Error {
  kind: ProviderFailureReason;
  status?: number;

  constructor(kind: ProviderFailureReason, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
  }
}
