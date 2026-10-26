import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOwnerAuthorizationDecision } from "@/lib/ownerAuthorization";

export type OwnerSession = { client: SupabaseClient; userId: string; token: string };

export function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

async function verifyToken(
  request: Request
): Promise<{ token: string; client: SupabaseClient; userId: string } | Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in is required." }, 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Media generation is not configured (missing Supabase env)." }, 503);
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.getUser(token);

  if (error || !data.user) {
    return json({ error: "Your sign-in expired. Sign in again." }, 401);
  }

  return { token, client, userId: data.user.id };
}

/**
 * Any signed-in account, plus whether it happens to be the configured owner.
 *
 * Selling access means the door has to admit customers, so the gate most
 * routes want is "is this a real session" — what a user may then reach is
 * decided by RLS, which asks whose row it is. `authorizeOwner` stays strict
 * for the operations that are genuinely platform-wide: provider keys,
 * provider configuration and email triage must never open up merely because
 * someone is willing to pay.
 */
export type UserSession = OwnerSession & {
  isOwner: boolean;
  /** False when OMNIAI_OWNER_ID is unset — nobody is the owner, which is not
   *  the same as everyone being one. */
  ownerConfigured: boolean;
};

export async function authorizeUser(request: Request): Promise<UserSession | Response> {
  const verified = await verifyToken(request);
  if (verified instanceof Response) return verified;

  const decision = getOwnerAuthorizationDecision(verified.userId, process.env.OMNIAI_OWNER_ID);

  return {
    ...verified,
    isOwner: decision === "owner",
    ownerConfigured: decision !== "not-configured",
  };
}

export function isUserSession(value: UserSession | Response): value is UserSession {
  return !(value instanceof Response);
}

/**
 * Verify the caller is the configured OmniAI owner and return a Supabase
 * client bound to that user's session (so storage + RLS writes use the user's
 * own JWT — no service-role key required).
 */
export async function authorizeOwner(request: Request): Promise<OwnerSession | Response> {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  if (!session.ownerConfigured) {
    return json(
      {
        error:
          "Media owner access is not configured. Set OMNIAI_OWNER_ID (your Supabase user id) in your environment — Vercel → Settings → Environment Variables, or omniai/.env.local — then redeploy or restart.",
      },
      503
    );
  }
  if (!session.isOwner) {
    return json({ error: "You are not authorized to generate media." }, 403);
  }

  return session;
}

export function isOwnerSession(value: OwnerSession | Response): value is OwnerSession {
  return !(value instanceof Response);
}
