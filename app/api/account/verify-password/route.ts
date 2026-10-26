import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Confirm the signed-in caller still knows their current password, without
 * touching their live session. The credentials are replayed against GoTrue's
 * password grant server-side: a good password returns a token (discarded),
 * a wrong one returns 400. This is what lets the change-password form ask
 * for "current password" without re-running signInWithPassword in the
 * browser — which would quietly downgrade an MFA-elevated (AAL2) session.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in is required." }, 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Account security is not configured (missing Supabase env)." }, 503);
  }

  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user?.email) {
    return json({ error: "Your sign-in expired. Sign in again." }, 401);
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) return json({ error: "Current password is required." }, 400);

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email: data.user.email, password }),
  });

  if (response.ok) return json({ valid: true });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return json({ valid: false });
  }
  return json({ error: "Could not verify the password right now. Try again." }, 502);
}
