import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyOverrides } from "./config";

/**
 * Owner-saved provider credentials, stored server-side in Supabase and
 * encrypted at rest with OMNIAI_KEY_SECRET (AES-256-GCM).
 *
 * Security model:
 *  - The plaintext secret is never returned over the API. Media Studio only
 *    ever learns which env names are stored, never their values.
 *  - The browser can technically read the ciphertext rows (owner RLS), but the
 *    ciphertext is useless without OMNIAI_KEY_SECRET, which lives only in the
 *    server environment.
 *  - A real environment variable always wins over a stored value, so an ops
 *    secret cannot be shadowed from the UI.
 */

const TABLE = "provider_keys";
const ALGORITHM = "aes-256-gcm";

/** Whether in-app key storage is usable (OMNIAI_KEY_SECRET is present). */
export function keySecretConfigured(): boolean {
  return Boolean(process.env.OMNIAI_KEY_SECRET?.trim());
}

function encryptionKey(): Buffer {
  const secret = process.env.OMNIAI_KEY_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "In-app key storage is disabled: set OMNIAI_KEY_SECRET to a long random value."
    );
  }
  // Derive a fixed 32-byte key from the (possibly long) secret.
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(blob: string): string {
  const [ivB64, tagB64, dataB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed stored secret.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export interface StoredKeys {
  /** env name -> decrypted secret, ready to hand to the providers. */
  overrides: KeyOverrides;
  /** Every env name that has a row (even if it could not be decrypted). */
  envNames: string[];
}

/**
 * Load the owner's stored credentials for the current session. Fails soft:
 * if OMNIAI_KEY_SECRET is unset, or the table is missing, it returns nothing
 * and generation simply falls back to environment variables.
 */
export async function loadStoredKeys(client: SupabaseClient): Promise<StoredKeys> {
  if (!keySecretConfigured()) return { overrides: {}, envNames: [] };

  const { data, error } = await client.from(TABLE).select("env_name, ciphertext");
  if (error || !data) return { overrides: {}, envNames: [] };

  const overrides: KeyOverrides = {};
  const envNames: string[] = [];
  for (const row of data as { env_name: string; ciphertext: string }[]) {
    envNames.push(row.env_name);
    try {
      overrides[row.env_name] = decryptSecret(row.ciphertext);
    } catch {
      // Leave undecryptable rows out of overrides; the UI still shows them.
    }
  }
  return { overrides, envNames };
}

export async function saveStoredKey(
  client: SupabaseClient,
  envName: string,
  value: string
): Promise<void> {
  const { error } = await client.from(TABLE).upsert(
    { env_name: envName, ciphertext: encryptSecret(value), updated_at: new Date().toISOString() },
    { onConflict: "env_name" }
  );
  if (error) throw new Error(error.message);
}

export async function deleteStoredKey(client: SupabaseClient, envName: string): Promise<void> {
  const { error } = await client.from(TABLE).delete().eq("env_name", envName);
  if (error) throw new Error(error.message);
}
