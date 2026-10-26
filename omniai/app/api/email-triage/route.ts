import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scanGmailForAlerts } from "@/lib/email/triage";
import { getOwnerAuthorizationDecision } from "@/lib/ownerAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOwnerSession(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const decision = getOwnerAuthorizationDecision(data.user.id, process.env.OMNIAI_OWNER_ID);
  if (decision !== "owner") return null;

  return data.user;
}

export async function GET(request: Request) {
  const user = await requireOwnerSession(request);
  if (!user) {
    return NextResponse.json({ error: "Signed-in owner access is required." }, { status: 401 });
  }

  return NextResponse.json({
    gmailConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI
    ),
    guidance: "Use a valid Gmail OAuth access token with the scan action to review unread priority mail.",
  });
}

export async function POST(request: Request) {
  const user = await requireOwnerSession(request);
  if (!user) {
    return NextResponse.json({ error: "Signed-in owner access is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  if (body.action === "gmail-scan") {
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "An OAuth access token is required for Gmail triage." }, { status: 400 });
    }

    try {
      const alerts = await scanGmailForAlerts(accessToken, 8);
      return NextResponse.json({ source: "gmail", total: alerts.length, alerts });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Gmail triage failed." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unsupported email action." }, { status: 400 });
}
