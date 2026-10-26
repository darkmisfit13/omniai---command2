"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DatabaseStatus = {
  state: "checking" | "connected" | "failed";
  detail: string;
};

/**
 * Supabase database — the store behind persona memory, provider settings and
 * the approval queue. Runs the same requests the dashboard checks so the
 * customer sees one honest answer about whether the database is answering.
 */
export default function DatabasePage() {
  const [status, setStatus] = useState<DatabaseStatus>({
    state: "checking",
    detail: "Checking database requests…",
  });

  const checkDatabase = useCallback(async () => {
    setStatus({ state: "checking", detail: "Checking database requests…" });

    try {
      const [persona, providers, approvals] = await Promise.all([
        supabase.from("persona").select("id").limit(1),
        supabase.from("providers").select("name, enabled"),
        supabase
          .from("approval_queue")
          .select("id", { count: "exact", head: true }),
      ]);

      const worked = [persona, providers, approvals].filter(
        (response) => !response.error,
      ).length;

      setStatus(
        worked === 3
          ? {
              state: "connected",
              detail:
                "All database requests succeeded — persona, providers, and the approval queue answered.",
            }
          : worked > 0
            ? {
                state: "connected",
                detail: `${worked} of 3 requests succeeded; another needs review.`,
              }
            : {
                state: "failed",
                detail:
                  "Database requests failed. Check your session, configuration, permissions, and service availability.",
              },
      );
    } catch {
      setStatus({
        state: "failed",
        detail: "Could not complete the database check.",
      });
    }
  }, []);

  useEffect(() => {
    void checkDatabase();
  }, [checkDatabase]);

  return (
    <div className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="dms-mono text-[10px] tracking-[0.24em] text-[#8d7fae]">
          SYSTEMS / DATABASE
        </p>
        <h2 className="pilot-voice text-2xl">Supabase database</h2>
        <p className="text-sm text-ash">
          The store behind persona memory, provider settings, and the approval
          queue. This page runs the same requests the dashboard checks.
        </p>
      </header>

      <section className="space-y-2 rounded-xl border border-[#443253] bg-[linear-gradient(145deg,#120e1c,#0b0a12)] p-4 shadow-[inset_0_1px_#ffffff05,0_8px_28px_#00000012]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#e9e2fa]">
            Connection status
          </h3>
          <button
            className="dms-mono rounded-lg border border-[#906fc754] bg-[#6949a81a] px-3 py-1.5 text-[10px] font-bold text-[#c7b6ed] transition-colors hover:border-[#b092ff9e] hover:bg-[#7952c733] disabled:opacity-50"
            type="button"
            onClick={() => void checkDatabase()}
            disabled={status.state === "checking"}
          >
            {status.state === "checking" ? "Checking…" : "Recheck"}
          </button>
        </div>

        <p
          className={`text-xs ${
            status.state === "failed" ? "text-[#fb7185]" : "text-ash"
          }`}
          role="status"
        >
          {status.detail}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[#e9e2fa]">Related</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border border-[#906fc754] bg-[#6949a81a] px-3 py-1.5 text-[11px] font-semibold text-[#c7b6ed] transition-colors hover:border-[#b092ff9e] hover:bg-[#7952c733]"
            href="/settings"
          >
            Provider settings ↗
          </Link>
          <Link
            className="rounded-lg border border-[#906fc754] bg-[#6949a81a] px-3 py-1.5 text-[11px] font-semibold text-[#c7b6ed] transition-colors hover:border-[#b092ff9e] hover:bg-[#7952c733]"
            href="/approvals"
          >
            Approval queue ↗
          </Link>
          <Link
            className="rounded-lg border border-[#906fc754] bg-[#6949a81a] px-3 py-1.5 text-[11px] font-semibold text-[#c7b6ed] transition-colors hover:border-[#b092ff9e] hover:bg-[#7952c733]"
            href="/environment"
          >
            Personal environment ↗
          </Link>
        </div>
      </section>

      <p className="text-xs text-ash">
        <Link className="text-signal underline-offset-2 hover:underline" href="/dashboard">
          Back to the dashboard
        </Link>
        .
      </p>
    </div>
  );
}
