/**
 * OmniAI — Self-Correction Log Parser
 * =====================================
 * Transforms a synthetic session report into structured findings the repair
 * agent can act on: slow/bottleneck endpoints, high-error paths, edge cases,
 * and severity. Also builds the repair prompt fed back to the Lead Agent.
 */

import type { SyntheticReport } from "./syntheticSession";

export interface SandboxFinding {
  severity: "error" | "warning" | "info";
  path: string;
  rule: string;
  message: string;
  evidence: string;
}

export function parseSyntheticReport(report: SyntheticReport): SandboxFinding[] {
  const findings: SandboxFinding[] = [];

  // Hard failures: any 5xx / exception.
  for (const h of report.summary.stepHotspots) {
    const failedTraceStep = { step: h.step, failRate: h.failRate, avgMs: h.avgMs };
    // reconstruct test instances from traces
    void failedTraceStep;
  }

  // Aggregate per-step across traces.
  const byStep = new Map<string, { n: number; fails: number; avgMs: number; minStatus?: number; maxLat?: number }>();
  let allSteps = 0;
  for (const t of report.traces) {
    for (const s of t.steps) {
      for (const r of s.results) {
        allSteps += 1;
        const cur = byStep.get(r.method + " " + r.path) ?? { n: 0, fails: 0, avgMs: 0 };
        cur.n += 1;
        if (!r.ok) cur.fails += 1;
        cur.avgMs = Math.round((cur.avgMs * (cur.n - 1) + r.durMs) / cur.n);
        if (r.status >= 500) cur.minStatus = r.status;
        byStep.set(r.method + " " + r.path, cur);
      }
    }
  }

  if (allSteps === 0) {
    findings.push({ severity: "error", path: report.baseUrl, rule: "no-traffic", message: "No requests completed; endpoint may be unreachable.", evidence: "0 total step runs" });
    return findings;
  }

  for (const [step, agg] of byStep) {
    const failRate = agg.n ? agg.fails / agg.n : 0;
    if (failRate >= 0.2) {
      findings.push({
        severity: failRate >= 0.5 ? "error" : "warning",
        path: step,
        rule: "request-failure",
        message: `${Math.round(failRate * 100)}% of requests to ${step} failed.`,
        evidence: `${agg.fails}/${agg.n} failed; avg ${agg.avgMs}ms`,
      });
    }
    // Bottleneck: p95 latency proxy → avg gate.
    if (agg.avgMs >= 1500) {
      findings.push({
        severity: "warning",
        path: step,
        rule: "slow-endpoint",
        message: `${step} is slow (avg ${agg.avgMs}ms).`,
        evidence: "Performance bottleneck — optimize query / caching.",
      });
    }
    if (agg.minStatus && agg.minStatus >= 500) {
      findings.push({
        severity: "error",
        path: step,
        rule: "server-error",
        message: `${step} returned 5xx (${agg.minStatus}).`,
        evidence: "Edge-case script failure; inspect server logs.",
      });
    }
  }

  if (report.summary.errorRate > 0.1) {
    findings.push({
      severity: "warning",
      path: report.baseUrl,
      rule: "high-error-rate",
      message: `Overall error rate ${Math.round(report.summary.errorRate * 100)}%.`,
      evidence: "Stress test across virtual users.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      path: report.baseUrl,
      rule: "clean-run",
      message: "Synthetic session completed without findings.",
      evidence: `${report.summary.totalRequests} requests, p95 ${report.summary.p95}ms`,
    });
  }

  return findings;
}

export function buildRepairPrompt(report: SyntheticReport, findings: SandboxFinding[]): string {
  const block = findings.map((f) => `[${f.severity.toUpperCase()}] ${f.path} [${f.rule}] ${f.message}  -- ${f.evidence}`).join("\n");
  return [
    "You are the Lead Director repair agent. The synthetic user session test revealed the following findings.",
    "Rewrite/fix/optimize the implementation to eliminate every finding. Return complete fixed files as a JSON array of {path,content}.",
    "Findings:",
    block,
    `Load profile: ${report.profile.concurrentUsers} users × ${report.profile.iterations} iterations. p95=${report.summary.p95}ms, errors=${report.summary.failures}.`,
    `Base URL: ${report.baseUrl}`,
  ].join("\n");
}
