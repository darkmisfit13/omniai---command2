import { logDirectorOp } from "@/lib/directorMode";

/**
 * Telemetry channels for the Live Thread Reflection Dashboard.
 *
 * The Director's ops ledger is not just a log — it is the live, tag-formatted
 * trace of what the system is doing between the user and the model:
 *
 *   [Memory Sync]   context anchors merged / stale fragments re-indexed
 *   [Orchestration] cross-studio chain steps
 *   [Routing]       local-vs-cloud dispatch decisions
 *   [Shield]        Repository Protection Protocol outcomes
 *   [Gateway]       provider routing / fallback
 *   [Sandbox]       build preflight / self-heal findings
 *
 * All of these land in the same ledger, so the Dashboard reads as one
 * step-by-step reflection of the running system.
 */

export const TELEMETRY = {
  memory: "Memory Sync",
  orchestration: "Orchestration",
  routing: "Routing",
  shield: "Shield",
  gateway: "Gateway",
  sandbox: "Sandbox",
  security: "Security",
} as const;

export type TelemetryTag = (typeof TELEMETRY)[keyof typeof TELEMETRY];

/** Emit one telemetry line into the Director ledger. Safe no-op before mount. */
export function emitTelemetry(tag: TelemetryTag | string, text: string, module?: string): string {
  return logDirectorOp(text, module, tag);
}
