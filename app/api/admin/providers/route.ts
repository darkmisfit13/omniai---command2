import { authorizeOwner, isOwnerSession, json } from "@/lib/generation/serverAuth";
import { describeAllPipelines, describeChatProviders, type ChatProviderStatus, type ProviderStatus } from "@/lib/generation/inspect";
import { loadStoredKeys, keySecretConfigured } from "@/lib/generation/secretStore";
import { loadProviderStates, setProviderEnabled } from "@/lib/generation/providerSettings";
import { generationConfig } from "@/lib/generation/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/providers
 *
 * The full AI provider catalog for the owner-only Admin -> AI Providers
 * console: every chat, image, video, music and voice provider with its
 * connection state (server env vs. saved in the app vs. missing) and its
 * enabled switch. Never returns any secret — only which env names exist.
 */
export async function GET(request: Request) {
  const session = await authorizeOwner(request);
  if (!isOwnerSession(session)) return session;

  const { envNames } = await loadStoredKeys(session.client);
  const stored = new Set(envNames);
  const { states, available } = await loadProviderStates(session.client);

  const chat = describeChatProviders(stored);
  const media = describeAllPipelines(stored);

  type ProviderRow = ChatProviderStatus & { enabled: boolean; capabilities: string[] };

  const toRow = (entry: ChatProviderStatus | ProviderStatus, capabilities: string[]): ProviderRow => ({
    id: entry.id,
    label: entry.label,
    transport: entry.transport,
    model: entry.model,
    free: entry.free,
    keyRequired: entry.keyRequired,
    keyEnv: entry.keyEnv,
    keyConfigured: entry.keyConfigured,
    keySource: entry.keySource,
    endpoint: generationConfig.providers[entry.id]?.endpoint ?? null,
    docs: entry.docs,
    ready: entry.ready,
    enabled: states[entry.id] !== false,
    capabilities,
  });

  // A provider can serve several pipelines (ElevenLabs: music + voice;
  // Lovable: chat + image + video + voice). Collapse to one row per provider
  // with the union of its capabilities, so the console shows each key once.
  const byId = new Map<string, ProviderRow>();
  for (const entry of chat) byId.set(entry.id, toRow(entry, ["chat"]));

  (Object.keys(media) as (keyof typeof media)[]).forEach((pipeline) => {
    for (const entry of media[pipeline] as ProviderStatus[]) {
      const existing = byId.get(entry.id);
      if (existing) {
        if (!existing.capabilities.includes(pipeline)) existing.capabilities.push(pipeline);
        continue;
      }
      byId.set(entry.id, toRow(entry, [pipeline]));
    }
  });

  const providers = [...byId.values()].map((entry) => ({
    ...entry,
    ready: entry.ready && entry.enabled,
  }));

  return json({
    ownerEnvConfigured: Boolean(process.env.OMNIAI_OWNER_ID?.trim()),
    storage: { keySecretConfigured: keySecretConfigured() },
    settingsTableAvailable: available,
    pipelineOrder: {
      chat: generationConfig.pipelines.chat?.order ?? [],
      image: generationConfig.pipelines.image?.order ?? [],
      music: generationConfig.pipelines.music?.order ?? [],
      video: generationConfig.pipelines.video?.order ?? [],
      voice: generationConfig.pipelines.voice?.order ?? [],
    },
    providers,
  });
}

/**
 * POST /api/admin/providers
 * Body: { providerId, enabled }
 *
 * Owner-only switch: pause a provider without deleting its stored key, or
 * resume it. RLS on provider_settings only accepts writes from the owner, so
 * this stays locked even if the route check were bypassed.
 */
export async function POST(request: Request) {
  const session = await authorizeOwner(request);
  if (!isOwnerSession(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { providerId?: unknown; enabled?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ error: "Send a JSON object with providerId and enabled." }, 400);
  }

  const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
  if (!providerId || !generationConfig.providers[providerId]) {
    return json({ error: "Unknown provider id." }, 400);
  }
  if (typeof body.enabled !== "boolean") {
    return json({ error: "enabled must be true or false." }, 400);
  }

  try {
    await setProviderEnabled(session.client, providerId, body.enabled);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save the switch." }, 500);
  }

  return json({ ok: true, providerId, enabled: body.enabled });
}
