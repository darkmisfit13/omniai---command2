"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface SubTaskResult { taskId: string; role: string; ok: boolean; output: string; model: string; durationMs: number; error?: string; }

export default function SwarmPage() {
  const [instruction, setInstruction] = useState("Build a Next.js dashboard with login, projects, billing, synthetic user tests, and deploy to staging.");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SubTaskResult[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResults([]);
    setSynthesis("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError("Sign in required — the swarm endpoint needs an authenticated account."); setRunning(false); return; }
      const res = await fetch("/api/swarm", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ instruction }) });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || data?.guidance || "Swarm run failed"); return; }
      setResults(data.results ?? []);
      setSynthesis(data.synthesis ?? "");
      setTotalMs(data.totalMs ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5 p-2">
      <header className="omni-glass rounded-2xl border border-white/[0.08] p-5 backdrop-blur-[20px]">
        <h1 className="text-xl font-bold text-[#e8e6f2]">Autonomous Intelligence Swarm</h1>
        <p className="mt-1 text-xs text-[#9490ac]">
          Hierarchical Lead Director orchestrates parallel specialized sub-agents (code, prompt, syntax, packaging). Heavy logic routes to the flagship model; syntax runs on fast inference.
        </p>
      </header>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={4}
        className="w-full rounded-xl border border-[#211d34] bg-[#0b0a14] p-3 text-sm text-[#e8e6f2] outline-none focus:border-[#8b7fff]"
      />
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={running} className="d3-btn d3-btn--primary">
          {running ? "Swarm running…" : "Launch Swarm"}
        </button>
        {totalMs != null && <span className="font-mono text-xs text-[#9490ac]">Completed in {totalMs}ms</span>}
      </div>
      {error && <p className="text-sm text-[#fb7185]">{error}</p>}

      {results.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9490ac]">Sub-Agent Results</h2>
          {results.map((r) => (
            <div key={r.taskId} className="omni-surface rounded-xl border border-white/[0.08] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#c5bfff]">{r.role.toUpperCase()} AGENT</span>
                <span className="font-mono text-[10px] text-[#9490ac]">{r.model} · {r.durationMs}ms · {r.ok ? "OK" : "FAIL"}</span>
              </div>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-[#e8e6f2]">{r.output}</pre>
              {r.error && <p className="mt-2 text-xs text-[#fb7185]">{r.error}</p>}
            </div>
          ))}
        </section>
      )}

      {synthesis && (
        <section className="omni-glass rounded-2xl border border-white/[0.08] p-5 backdrop-blur-[20px]">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9490ac]">Synthesised Output</h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-[#e8e6f2]">{synthesis}</pre>
        </section>
      )}
    </div>
  );
}
