/**
 * OmniAI — OmniForge Synthetic User Session Tester
 * ==================================================
 * Spins up virtual user instances that exercise a (local, user-hosted
 * or deployed) generated web application: open routes, type, submit
 * forms, run checkout flows, and stress-test API connections under
 * simulated concurrent load.
 *
 * Runs server-side so CORS/loopback is reachable, and returns a structured
 * trace that the Log Parser (logParser.ts) turns into repair instructions.
 */

export interface SyntheticStep {
  name: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: unknown;
  /** assert these tokens are present in response text. */
  expectText?: string[];
  /** Expected status code range. */
  expectStatus?: number;
  /** artificial think time before next step (ms). */
  thinkMs?: number;
}

export interface SyntheticFlow {
  id: string;
  name: string;
  steps: SyntheticStep[];
}

export interface LoadProfile {
  /** Number of concurrent virtual users. */
  concurrentUsers: number;
  /** How many iterations each virtual user runs. */
  iterations: number;
  /** Ramp-up delay between users (ms). */
  rampUpMs: number;
}

export interface SyntheticRequestResult {
  path: string;
  method: string;
  status: number;
  durMs: number;
  ok: boolean;
  error?: string;
  bytes: number;
}

export interface VirtualUserTrace {
  userId: number;
  flowId: string;
  iterations: number;
  steps: { name: string; results: SyntheticRequestResult[]; failed: number }[];
  totalMs: number;
}

export const defaultFlows: SyntheticFlow[] = [
  {
    id: "navigation",
    name: "Core Navigation",
    steps: [
      { name: "Home", method: "GET", path: "/", expectText: ["<html", "<body"], expectStatus: 200, thinkMs: 120 },
      { name: "Health", method: "GET", path: "/api/health" },
    ],
  },
  {
    id: "search",
    name: "Search Flow",
    steps: [
      { name: "Query", method: "GET", path: "/api/search?q=omni", expectStatus: 200, thinkMs: 80 },
    ],
  },
  {
    id: "checkout",
    name: "Checkout Stress",
    steps: [
      { name: "Cart", method: "GET", path: "/api/cart", expectStatus: 200 },
      { name: "Order", method: "POST", path: "/api/orders", body: { items: [{ id: "demo", qty: 1 }] }, expectStatus: 200 },
    ],
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

async function runStep(baseUrl: string, step: SyntheticStep): Promise<SyntheticRequestResult> {
  const t0 = Date.now();
  const url = baseUrl.replace(/\/$/, "") + step.path;
  const opts: RequestInit = { method: step.method ?? "GET", redirect: "follow", cache: "no-store" };
  if (step.body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(step.body);
  }
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    const okStatus = step.expectStatus ? res.status === step.expectStatus : res.status >= 200 && res.status < 400;
    let ok = okStatus;
    if (step.expectText?.length) {
      ok = ok && step.expectText.every((needle) => text.includes(needle));
    }
    return { path: step.path, method: opts.method ?? "GET", status: res.status, durMs: Date.now() - t0, ok, bytes: text.length };
  } catch (e) {
    return { path: step.path, method: opts.method ?? "GET", status: 0, durMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), bytes: 0 };
  }
}

async function runFlowIteration(baseUrl: string, flow: SyntheticFlow): Promise<VirtualUserTrace["steps"][number]> {
  const res: VirtualUserTrace["steps"][number] = { name: flow.name, results: [], failed: 0 };
  for (const step of flow.steps) {
    const r = await runStep(baseUrl, step);
    res.results.push(r);
    if (!r.ok) res.failed += 1;
    if (step.thinkMs) await sleep(step.thinkMs);
  }
  return res;
}

export async function runSyntheticSession(baseUrl: string, profile: LoadProfile, flows: SyntheticFlow[] = defaultFlows): Promise<VirtualUserTrace[]> {
  const traces: (Promise<VirtualUserTrace> | VirtualUserTrace)[] = [];
  for (let u = 0; u < profile.concurrentUsers; u += 1) {
    traces.push(runVirtualUser(u + 1, baseUrl, profile, flows, u * profile.rampUpMs));
  }
  return Promise.all(traces.map((t) => t as Promise<VirtualUserTrace>));
}

async function runVirtualUser(userId: number, baseUrl: string, profile: LoadProfile, flows: SyntheticFlow[], ramp: number): Promise<VirtualUserTrace> {
  await sleep(ramp);
  const t0 = Date.now();
  const trace: VirtualUserTrace = { userId, flowId: flows[0]?.id ?? "none", iterations: 0, steps: [], totalMs: 0 };
  for (let i = 0; i < profile.iterations; i += 1) {
    for (const flow of flows) {
      const r = await runFlowIteration(baseUrl, flow);
      trace.steps.push(r);
      trace.iterations += 1;
    }
  }
  trace.totalMs = Date.now() - t0;
  return trace;
}

export interface SyntheticReport {
  baseUrl: string;
  profile: LoadProfile;
  traces: VirtualUserTrace[];
  summary: {
    totalRequests: number;
    failures: number;
    errorRate: number;
    p50: number;
    p95: number;
    maxMs: number;
    stepHotspots: { step: string; failRate: number; avgMs: number }[];
  };
}

export function summarizeSession(baseUrl: string, profile: LoadProfile, traces: VirtualUserTrace[]): SyntheticReport {
  const all: SyntheticRequestResult[] = [];
  for (const t of traces) for (const s of t.steps) for (const r of s.results) all.push(r);

  const fails = all.filter((r) => !r.ok).length;
  const durs = all.map((r) => r.durMs).sort((a, b) => a - b);
  const maxMs = durs.length ? durs[durs.length - 1] : 0;
  const p50 = percentile(durs, 50);
  const p95 = percentile(durs, 95);

  const stepMap = new Map<string, SyntheticRequestResult[]>();
  for (const r of all) {
    const key = r.method + " " + r.path;
    const arr = stepMap.get(key) ?? [];
    arr.push(r);
    stepMap.set(key, arr);
  }
  const stepHotspots = [...stepMap.entries()].map(([step, arr]) => {
    const f = arr.filter((r) => !r.ok).length;
    const avg = Math.round(arr.reduce((a, b) => a + b.durMs, 0) / arr.length);
    return { step, failRate: arr.length ? f / arr.length : 0, avgMs: avg };
  }).sort((a, b) => b.avgMs - a.avgMs);

  return {
    baseUrl,
    profile,
    traces,
    summary: {
      totalRequests: all.length,
      failures: fails,
      errorRate: fails / (all.length || 1),
      p50,
      p95,
      maxMs,
      stepHotspots,
    },
  };
}
