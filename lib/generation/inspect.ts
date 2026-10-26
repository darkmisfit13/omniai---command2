import { generationConfig } from "./config";
import type { MediaPipeline } from "./types";

/** Where a provider's credential came from. */
export type CredentialSource = "env" | "app" | null;

export interface ProviderStatus {
  id: string;
  label: string;
  transport: string;
  model: string | null;
  free: boolean;
  /** The pipeline this provider can actually generate. */
  supported: boolean;
  /** Whether the provider needs an API key at all. */
  keyRequired: boolean;
  /** Which env var holds the key (for the setup hint). */
  keyEnv: string | null;
  /** True when the key is present in the environment or saved in the app. */
  keyConfigured: boolean;
  /** "env" = server environment variable, "app" = saved in Media Studio. */
  keySource: CredentialSource;
  /** Optional second env var (e.g. a Cloudflare account id). */
  accountEnv: string | null;
  accountConfigured: boolean;
  accountSource: CredentialSource;
  /** Where to create/obtain the key, if the provider documents it. */
  docs: string | null;
  /** Ready to attempt a real request right now. */
  ready: boolean;
}

/** Classify a single env var as coming from the environment or the app store. */
function sourceFor(envName: string | null | undefined, stored: Set<string>): CredentialSource {
  if (!envName) return null;
  if (process.env[envName]?.trim()) return "env";
  if (stored.has(envName)) return "app";
  return null;
}

/**
 * Describe the providers for a pipeline without generating anything or
 * exposing any secret values. Used by the Media Studio "Test providers" panel
 * so the owner can see, per provider, whether its key is configured and where
 * that credential lives. `storedEnvNames` are env names saved via Media Studio.
 */
export function describePipeline(
  pipeline: MediaPipeline,
  storedEnvNames: Set<string> = new Set()
): ProviderStatus[] {
  const definition = generationConfig.pipelines[pipeline];
  if (!definition) return [];

  return definition.order.map((id) => {
    const provider = generationConfig.providers[id];
    const model = provider?.models[pipeline] ?? null;
    const keyRequired = Boolean(provider?.keyRequired);

    const keyCandidates = [provider?.keyEnv, ...(provider?.keyEnvAlt ?? [])].filter(
      (name): name is string => Boolean(name)
    );
    let keySource: CredentialSource = null;
    for (const name of keyCandidates) {
      keySource = sourceFor(name, storedEnvNames);
      if (keySource) break;
    }
    const keyConfigured = keyRequired ? keySource !== null : true;

    const accountEnv = provider?.accountEnv ?? null;
    const accountSource = sourceFor(accountEnv, storedEnvNames);
    const accountConfigured = accountEnv ? accountSource !== null : true;
    const supported = Boolean(model) && provider?.transport !== "none";

    return {
      id,
      label: provider?.label ?? id,
      transport: provider?.transport ?? "unknown",
      model,
      free: Boolean(provider?.free),
      supported,
      keyRequired,
      keyEnv: provider?.keyEnv ?? null,
      keyConfigured,
      keySource,
      accountEnv,
      accountConfigured,
      accountSource,
      docs: provider?.docs ?? null,
      ready: supported && keyConfigured && accountConfigured,
    };
  });
}

export function describeAllPipelines(
  storedEnvNames: Set<string> = new Set()
): Record<MediaPipeline, ProviderStatus[]> {
  return {
    image: describePipeline("image", storedEnvNames),
    music: describePipeline("music", storedEnvNames),
    video: describePipeline("video", storedEnvNames),
    voice: describePipeline("voice", storedEnvNames),
  };
}

export interface ChatProviderStatus {
  id: string;
  label: string;
  transport: string;
  model: string | null;
  free: boolean;
  keyRequired: boolean;
  keyEnv: string | null;
  keyConfigured: boolean;
  keySource: CredentialSource;
  endpoint: string | null;
  docs: string | null;
  ready: boolean;
}

/**
 * Describe the chat/text providers (the "chat" pipeline). Used by the
 * owner-only Admin -> AI Providers console so every text provider can be
 * connected, disconnected and tested from one place.
 */
export function describeChatProviders(
  storedEnvNames: Set<string> = new Set()
): ChatProviderStatus[] {
  const definition = generationConfig.pipelines.chat;
  if (!definition) return [];

  return definition.order.map((id) => {
    const provider = generationConfig.providers[id];
    const model = provider?.models.text ?? null;
    const keyRequired = Boolean(provider?.keyRequired);

    const keyCandidates = [provider?.keyEnv, ...(provider?.keyEnvAlt ?? [])].filter(
      (name): name is string => Boolean(name)
    );
    let keySource: CredentialSource = null;
    for (const name of keyCandidates) {
      keySource = sourceFor(name, storedEnvNames);
      if (keySource) break;
    }
    const keyConfigured = keyRequired ? keySource !== null : true;

    return {
      id,
      label: provider?.label ?? id,
      transport: provider?.transport ?? "unknown",
      model,
      free: Boolean(provider?.free),
      keyRequired,
      keyEnv: provider?.keyEnv ?? null,
      keyConfigured,
      keySource,
      endpoint: provider?.endpoint ?? null,
      docs: provider?.docs ?? null,
      ready: keyConfigured,
    };
  });
}
