import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyOwner(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const ownerId = (process.env.OMNIAI_OWNER_ID || "").trim();
  if (!ownerId || data.user.id !== ownerId) return null;
  return data.user;
}

export async function GET(request: Request) {
  const owner = await verifyOwner(request);
  if (!owner) return NextResponse.json({ error: "Forbidden: Admin access restricted." }, { status: 403 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl || !supabaseAdmin) {
    return NextResponse.json({ configured: false, users: [], note: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to omniai/.env.local (and Vercel env vars) to list registered users. Admin rights are restricted to your account only." });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ownerId = (process.env.OMNIAI_OWNER_ID || "").trim();
  const users = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    createdAt: u.created_at ?? null,
    emailConfirmedAt: (u as { email_confirmed_at?: string | null }).email_confirmed_at ?? null,
    isAdmin: u.id === ownerId,
    isBanned: !!(u as { banned_until?: string | null }).banned_until,
    bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
    lastSignInAt: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
  }));

  return NextResponse.json({ configured: true, users });
}

// DELETE action — ban (soft revoke) or hard delete a user's access. Owner only.
// usage: DELETE /api/admin/users?id=<user id>&mode=ban|delete (default ban)
export async function DELETE(request: Request) {
  const owner = await verifyOwner(request);
  if (!owner) return NextResponse.json({ error: "Forbidden: Admin access restricted." }, { status: 403 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const mode = url.searchParams.get("mode") || "ban";
  const ownerId = (process.env.OMNIAI_OWNER_ID || "").trim();
  if (!id) return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Admin client not configured." }, { status: 500 });
  if (id === ownerId) return NextResponse.json({ error: "Cannot remove your own access." }, { status: 400 });

  try {
    if (mode === "delete") {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw error;
      return NextResponse.json({ success: true, mode: "delete", id });
    }
    // ban forever (revoking sign-in access)
    const banUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(id, { banned_until: banUntil });
    if (error) throw error;
    return NextResponse.json({ success: true, mode: "ban", id, bannedUntil: banUntil });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to revoke access." }, { status: 500 });
  }
}
