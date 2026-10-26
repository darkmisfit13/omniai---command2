import { authorizeOwner, isOwnerSession, json } from "@/lib/generation/serverAuth";
import { generationConfig } from "@/lib/generation/config";
import {
  deleteStoredKey,
  keySecretConfigured,
  loadStoredKeys,
  saveStoredKey,
} from "@/lib/generation/secretStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SECRET_LENGTH = 500;

/** Every env var the owner is allowed to store a value for. */
function allowedEnvNames(): Set<string> {
  const names = new Set<string>();
  for (const provider of Object.values(generationConfig.providers)) {
    if (provider.keyEnv) names.add(provider.keyEnv);
    for (const alt of provider.keyEnvAlt ?? []) names.add(alt);
    if (provider.accountEnv) names.add(provider.accountEnv);
  }
  return names;
}

/**
 * GET /api/generate/keys
 * Reports whether in-app storage is enabled and which env names already have a
 * stored value. Never returns any secret.
 */
export async function GET(request: Request) {
  const session = await authorizeOwner(request);
  if (!isOwnerSession(session)) return session;

  const { envNames } = await loadStoredKeys(session.client);
  return json({ configured: keySecretConfigured(), stored: envNames });
}

/**
 * POST /api/generate/keys
 * Body: { envName, value }
 * Encrypts and stores one credential. The value is never returned.
 */
export async function POST(request: Request) {
  const session = await authorizeOwner(request);
  if (!isOwnerSession(session)) return session;

  if (!keySecretConfigured()) {
    return json(
      {
        error:
          "In-app key storage is off. Set OMNIAI_KEY_SECRET (a long random value) in Vercel → Settings → Environment Variables (or omniai/.env.local), then redeploy or restart. Until then you can still use server environment variables directly.",
      },
      503
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { envName?: unknown; value?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ error: "Send a JSON object with envName and value." }, 400);
  }

  const envName = typeof body.envName === "string" ? body.envName.trim() : "";
  if (!allowedEnvNames().has(envName)) {
    return json({ error: `"${envName}" is not a known provider credential.` }, 400);
  }

  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return json({ error: "Paste a key value first." }, 400);
  if (value.length > MAX_SECRET_LENGTH) {
    return json({ error: `That value is too long (max ${MAX_SECRET_LENGTH} characters).` }, 413);
  }

  try {
    await saveStoredKey(session.client, envName, value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the key.";
    const hint = message.toLowerCase().includes("provider_keys")
      ? " The provider_keys table is missing — run the latest media migration (docs/FREE_MEDIA_SETUP.md, step 0)."
      : "";
    return json({ error: `${message}.${hint}`, status: "save_failed" }, 502);
  }

  return json({ ok: true, envName, stored: true });
}

/**
 * DELETE /api/generate/keys
 * Body: { envName }
 * Removes a stored credential.
 */
export async function DELETE(request: Request) {
  const session = await authorizeOwner(request);
  if (!isOwnerSession(session)) return session;

  const body = (await request.json().catch(() => null)) as { envName?: unknown } | null;
  const envName = body && typeof body.envName === "string" ? body.envName.trim() : "";
  if (!allowedEnvNames().has(envName)) {
    return json({ error: `"${envName}" is not a known provider credential.` }, 400);
  }

  try {
    await deleteStoredKey(session.client, envName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the key.";
    return json({ error: message, status: "delete_failed" }, 502);
  }

  return json({ ok: true, envName, stored: false });
}
