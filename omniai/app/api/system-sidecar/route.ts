import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOwnerAuthorizationDecision } from "@/lib/ownerAuthorization";
import {
  SidecarError,
  fetchSidecarDiagnostics,
  rejectSidecarApproval,
  requestSidecarTaskKill,
} from "@/lib/pythonSidecar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function isAuthorizedLocal(request: Request) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") return false;

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return false;

  return getOwnerAuthorizationDecision(data.user.id, process.env.OMNIAI_OWNER_ID) === "owner";
}

function sidecarFailure(error: unknown) {
  if (error instanceof SidecarError) {
    const body = error.body;
    if (body && typeof body === "object" && "error" in body) {
      return json({ error: (body as { error: unknown }).error }, error.status);
    }
    return json({ error: error.message }, error.status);
  }
  return json({ error: "The Python sidecar request failed." }, 500);
}

export async function GET(request: Request) {
  if (process.env.VERCEL === "1") {
    return json({ error: "The Python sidecar is available only on this laptop." }, 404);
  }
  if (!(await isAuthorizedLocal(request))) {
    return json({ error: "Sidecar access requires a signed-in OmniAI owner session on this laptop." }, 401);
  }

  try {
    const payload = await fetchSidecarDiagnostics();
    return json(payload);
  } catch (error) {
    return sidecarFailure(error);
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL === "1") {
    return json({ error: "The Python sidecar is available only on this laptop." }, 404);
  }
  if (!(await isAuthorizedLocal(request))) {
    return json({ error: "Sidecar access requires a signed-in OmniAI owner session on this laptop." }, 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Send a JSON object." }, 400);
  }

  const action = (body as { action?: unknown }).action;

  try {
    if (action === "diagnostics") {
      return json(await fetchSidecarDiagnostics());
    }

    if (action === "taskkill") {
      const result = await requestSidecarTaskKill({
        pid: typeof (body as { pid?: unknown }).pid === "number" ? (body as { pid: number }).pid : undefined,
        name: typeof (body as { name?: unknown }).name === "string" ? (body as { name: string }).name : undefined,
        force: Boolean((body as { force?: unknown }).force),
        approved: Boolean((body as { approved?: unknown }).approved),
        approval_id:
          typeof (body as { approval_id?: unknown }).approval_id === "string"
            ? (body as { approval_id: string }).approval_id
            : undefined,
      });
      const status = "status" in result && result.status === "pending_approval" ? 202 : 200;
      return json(result, status);
    }

    if (action === "reject") {
      const approvalId = (body as { approval_id?: unknown }).approval_id;
      if (typeof approvalId !== "string" || !approvalId) {
        return json({ error: "approval_id is required to reject a pending command." }, 400);
      }
      await rejectSidecarApproval(approvalId);
      return json({ ok: true, status: "rejected" });
    }

    return json({ error: "Choose diagnostics, taskkill, or reject." }, 400);
  } catch (error) {
    return sidecarFailure(error);
  }
}
