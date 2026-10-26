"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AuditEntry } from "@/lib/types";

const outcomeColor: Record<string, string> = {
  allowed: "text-signal",
  approved: "text-signal",
  blocked: "text-ash",
  rejected: "text-ash",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setEntries(data ?? []));
  }, []);

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="pilot-voice text-2xl">Audit log</h2>
      {entries.length === 0 && <p className="text-ash">No actions recorded yet.</p>}
      {entries.map((e) => (
        <div key={e.id} className="border-b border-ash/20 pb-3">
          <div className="flex justify-between text-sm">
            <span>{e.action}</span>
            <span className={outcomeColor[e.outcome]}>{e.outcome}</span>
          </div>
          <p className="text-xs text-ink/50 break-words">{e.detail}</p>
          <p className="text-xs text-ash">{new Date(e.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
