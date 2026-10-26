"use client";

import { useState } from "react";

interface Hotspot { step: string; failRate: number; avgMs: number; }
interface Round { round: number; findings: { severity: string; path: string; rule: string; message: string; evidence: string }[]; reportSummary: { totalRequests: number; failures: number; errorRate: number; p50: number; p95: number; maxMs: number; stepHotspots: Hotspot[] }; }

export default function SyntheticLabPage() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:3000");
  const [concurrent, setConcurrent] = useState(4);
  const [iterations, setIterations] = useState(2);
  const [loops, setLoops] = useState(1);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setRounds([]);
    setError("");
    try {
      const res = await fetch("/api/sandbox/synthetic-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl, profile: { concurrentUsers: concurrent, iterations, rampUpMs: 120 }, loopIterations: loops }) });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed"); return; }
      setRounds(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5 p-2">
      <header className="omni-glass rounded-2xl border border-white/[0.08] p-5 backdrop-blur-[20px]">
        <h1 className="text-xl font-bold text-[#e8e6f2]">Synthetic User Session Testing Sandbox</h1>
        <p className="mt-1 text-xs text-[#9490ac]">
          Virtual users surf a target app — typing, submitting, checkout flows, API stress under load — while recording latencies and failures. The self-correction parser turns traces into repair prompts.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL" className="min-w-[260px] flex-1 rounded-xl border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-sm text-[#e8e6f2]" />
        <label className="flex items-center gap-1 text-xs text-[#9490ac]">Users <input type="number" value={concurrent} onChange={(e) => setConcurrent(Number(e.target.value))} className="w-16 rounded border border-[#211d34] bg-[#0b0a14] px-2 py-1 text-[#e8e6f2]" /></label>
        <label className="flex items-center gap-1 text-xs text-[#9490ac]">Iter <input type="number" value={iterations} onChange={(e) => setIterations(Number(e.target.value))} className="w-16 rounded border border-[#211d34] bg-[#0b0a14] px-2 py-1 text-[#e8e6f2]" /></label>
        <label className="flex items-center gap-1 text-xs text-[#9490ac]">Loops <input type="number" value={loops} onChange={(e) => setLoops(Number(e.target.value))} className="w-14 rounded border border-[#211d34] bg-[#0b0a14] px-2 py-1 text-[#e8e6f2]" /></label>
        <button onClick={run} disabled={running} className="d3-btn d3-btn--primary">{running ? "Running…" : "Run Synthetic Session"}</button>
      </div>
      {error && <p className="text-sm text-[#fb7185]">{error}</p>}

      {rounds.map((rd, i) => (
        <section key={i} className="omni-surface rounded-2xl border border-white/[0.08] p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9490ac]">Round {rd.round + 1}</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label="Requests" value={rd.reportSummary.totalRequests} />
            <Stat label="Failures" value={rd.reportSummary.failures} />
            <Stat label="Error Rate" value={(rd.reportSummary.errorRate * 100).toFixed(1) + "%"} />
            <Stat label="p50" value={rd.reportSummary.p50 + "ms"} />
            <Stat label="p95" value={rd.reportSummary.p95 + "ms"} />
          </div>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[#9490ac]">Hotspots</h3>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-[#9490ac]"><th className="py-1 text-left">Endpoint</th><th className="py-1 text-left">Fail Rate</th><th className="py-1 text-left">Avg ms</th></tr></thead>
            <tbody>
              {rd.reportSummary.stepHotspots.map((h, j) => (
                <tr key={j} className="text-[#e8e6f2]"><td className="py-1">{h.step}</td><td className="py-1">{(h.failRate * 100).toFixed(1)}%</td><td className="py-1">{h.avgMs}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[#9490ac]">Repair Findings</h3>
          <ul className="mt-2 space-y-1">
            {rd.findings.map((f, j) => (
              <li key={j} className="text-xs">
                <span className={"font-bold " + (f.severity === "error" ? "text-[#fb7185]" : f.severity === "warning" ? "text-[#ffb84d]" : "text-[#6ee7b7]")}>[{f.severity.toUpperCase()}]</span>
                <span className="ml-1 text-[#e8e6f2]">{f.path} — {f.message}</span>
                <span className="ml-1 text-[#9490ac]">({f.rule})</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="omni-glass rounded-xl border border-white/[0.08] p-3 text-center backdrop-blur-[20px]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#9490ac]">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#e8e6f2]">{value}</div>
    </div>
  );
}
