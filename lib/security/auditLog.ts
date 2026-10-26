import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Security audit sink (server-only).
 *
 * Shield events are written to `public.audit_log`, which is deliberately
 * read-only from the browser and written only by SECURITY DEFINER RPCs. We try
 * the RPC first; if the migration has not been applied yet we fall back to the
 * service-role client so the owner still sees the record. Everything is
 * best-effort — a logging failure must never take down the request.
 */

export type AuditOutcome = "allowed" | "blocked" | "approved" | "rejected";

export async function logSecurityEvent(params: {
  token?: string | null;
  action: string;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
}): Promise<{ logged: boolean; via: "rpc" | "admin" | "none" }> {
  const detail = params.detail ?? {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Preferred: the SECURITY DEFINER RPC, run as the caller.
  if (params.token && url && anonKey) {
    try {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${params.token}` } },
      });
      const { error } = await client.rpc("log_security_event", {
        p_action: params.action,
        p_outcome: params.outcome,
        p_detail: detail,
      });
      if (!error) return { logged: true, via: "rpc" };
    } catch {
      // fall through to the admin mirror
    }
  }

  // 2. Fallback: the service-role client (owner-scoped record).
  if (supabaseAdmin) {
    const ownerId = (process.env.OMNIAI_OWNER_ID || "").trim();
    const withOwner = {
      action: params.action,
      outcome: params.outcome,
      detail: JSON.stringify(detail),
      ...(ownerId ? { owner_id: ownerId } : {}),
    };
    try {
      const attempt = await supabaseAdmin.from("audit_log").insert([withOwner]);
      if (!attempt.error) return { logged: true, via: "admin" };

      // Older deployments may not have owner_id yet — retry without it.
      const fallback = await supabaseAdmin.from("audit_log").insert([
        {
          action: params.action,
          outcome: params.outcome,
          detail: JSON.stringify(detail),
        },
      ]);
      if (!fallback.error) return { logged: true, via: "admin" };
    } catch {
      // ignore and degrade
    }
  }

  // 3. Last resort — keep the event visible in server logs.
  console.warn("[omni-shield] audit sink unavailable", {
    action: params.action,
    outcome: params.outcome,
    detail,
  });
  return { logged: false, via: "none" };
}
