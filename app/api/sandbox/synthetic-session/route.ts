import { NextResponse } from "next/server";
import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";
import { runSyntheticSession, summarizeSession } from "@/lib/sandbox/syntheticSession";
import { parseSyntheticReport, buildRepairPrompt } from "@/lib/sandbox/logParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const b = (body ?? {}) as { baseUrl?: unknown; profile?: unknown };
  const baseUrl = typeof b.baseUrl === "string" ? b.baseUrl.trim() : "";
  if (!baseUrl) return json({ error: "baseUrl is required." }, 400);
  const profileRaw = (b.profile ?? {}) as Record<string, unknown>;
  const profile = {
    concurrentUsers: Math.max(1, Math.min(12, Number(profileRaw.concurrentUsers ?? 4))),
    iterations: Math.max(1, Math.min(8, Number(profileRaw.iterations ?? 2))),
    rampUpMs: Math.max(0, Math.min(1000, Number(profileRaw.rampUpMs ?? 120))),
  };
  const iterations = Math.max(1, Math.min(3, Number((body as { loopIterations?: unknown }).loopIterations ?? 1)));

  try {
    const history: {
      round: number;
      findings: ReturnType<typeof parseSyntheticReport>;
      reportSummary: ReturnType<typeof summarizeSession>["summary"];
      repairPrompt: string;
    }[] = [];

    for (let round = 0; round < iterations; round += 1) {
      const traces = await runSyntheticSession(baseUrl, profile);
      const report = summarizeSession(baseUrl, profile, traces);
      const findings = parseSyntheticReport(report);
      const repairPrompt = buildRepairPrompt(report, findings);
      history.push({ round, findings, reportSummary: report.summary, repairPrompt });
    }

    return json({
      baseUrl,
      profile,
      rounds: iterations,
      history,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Synthetic run failed." }, 502);
  }
}
