"use client";

/**
 * DIRECTOR MODE & SYSTEM PROMPT CONFIGURATION
 * Owner: OMNIAI_OWNER_id
 * Studio: DarkMisfitStudios
 * Persona: unafraid of heaviness
 * Engine: profile.json & Long-Term Memory
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Director Mode — the studio's autonomy layer.
 *
 * When active, the AI Director holds read/write reach across the whole
 * studio matrix (Omni Imagine, OmniMotion, OmniWave, OmniBeat, OmniCode,
 * Backend Architect, Media Library…), the workspace retints from signal
 * violet to radiant neon emerald, and every action the Director takes is
 * written to the Live Operations Console ledger.
 *
 * State here is deliberately UI-only: the actual authority boundary stays
 * with the Identity Lock / Security Shield on the server. Director Mode
 * widens what the workspace will chain together for a signed-in user — it
 * never widens who may modify the system.
 */

export type DirectorOpStatus = "running" | "ok" | "warn" | "error";

export interface DirectorOp {
  id: string;
  ts: number;
  text: string;
  status: DirectorOpStatus;
  module?: string;
  /** Telemetry channel, e.g. "Memory Sync" | "Orchestration" | "Routing" | "Shield". */
  tag?: string;
}

export type WorkspaceRequestPhase =
  | "idle"
  | "preflight"
  | "security"
  | "routing"
  | "local_execution"
  | "cloud_execution"
  | "director_execution"
  | "saving"
  | "succeeded"
  | "failed"
  | "blocked";

export interface WorkspaceRequestActivity {
  phase: WorkspaceRequestPhase;
  requestId: string | null;
  startedAt: number | null;
  updatedAt: number;
  provider: string | null;
  outputCharacters: number;
}

interface DirectorContextValue {
  active: boolean;
  toggle: () => void;
  ops: DirectorOp[];
  log: (text: string, module?: string, tag?: string) => string;
  resolveOp: (id: string, status: Exclude<DirectorOpStatus, "running">, text?: string) => void;
  clearOps: () => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  /** True while an autonomous chain is executing. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  requestActivity: WorkspaceRequestActivity;
  setRequestPhase: (
    phase: WorkspaceRequestPhase,
    details?: { provider?: string | null; outputCharacters?: number }
  ) => void;
}

const DirectorContext = createContext<DirectorContextValue | null>(null);

const STORAGE_KEY = "omni.director.mode";
const MAX_OPS = 140;

/**
 * Module-level sinks so the orchestrator (plain TS, outside React) can
 * write to the ledger without holding a context reference. Registered by
 * the provider on mount; every call is a safe no-op before then.
 */
type LedgerSink = {
  log: (text: string, module?: string, tag?: string) => string;
  resolveOp: (id: string, status: Exclude<DirectorOpStatus, "running">, text?: string) => void;
};
const ledgerSink: LedgerSink = {
  log: () => "",
  resolveOp: () => {},
};

export function logDirectorOp(text: string, module?: string, tag?: string) {
  return ledgerSink.log(text, module, tag);
}

export function resolveDirectorOp(
  id: string,
  status: Exclude<DirectorOpStatus, "running">,
  text?: string
) {
  ledgerSink.resolveOp(id, status, text);
}

/**
 * The handoff bus: how a chained step writes state into a module that is
 * not currently on screen. The payload persists under `omni.director.*`
 * in localStorage and fires a window event so an open module can pick it
 * up live. Every studio page can listen for `omni:director-handoff`.
 */
export const DIRECTOR_HANDOFF_EVENT = "omni:director-handoff";

export function writeHandoff(moduleRoute: string, payload: Record<string, unknown>) {
  const record = {
    route: moduleRoute,
    payload,
    at: new Date().toISOString(),
    by: "director",
  };
  try {
    window.localStorage.setItem(`omni.director.handoff.${moduleRoute}`, JSON.stringify(record));
  } catch {
    // Storage full or blocked — the in-memory event below still fires.
  }
  window.dispatchEvent(new CustomEvent(DIRECTOR_HANDOFF_EVENT, { detail: record }));
}

/**
 * Activation chime — synthesized, no audio asset required. ON rises,
 * OFF falls. Quiet by design: a confirmation, not a notification.
 */
function playChime(on: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = on ? [659.25, 987.77] : [987.77, 659.25]; // E5→B5 / B5→E5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.06, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.3);
    });

    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Audio unavailable — the switch still works, silently.
  }
}

export function DirectorProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState(false);
  const [ops, setOps] = useState<DirectorOp[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestActivity, setRequestActivity] = useState<WorkspaceRequestActivity>({
    phase: "idle",
    requestId: null,
    startedAt: null,
    updatedAt: 0,
    provider: null,
    outputCharacters: 0,
  });
  const opsTouched = useRef(false);

  // Restore persisted preference after mount (no SSR mismatch).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "on") {
        setActiveState(true);
        document.documentElement.dataset.director = "on";
      } else {
        document.documentElement.dataset.director = "off";
      }
    } catch {
      document.documentElement.dataset.director = "off";
    }
  }, []);

  const log = useCallback((text: string, module?: string, tag?: string) => {
    const op: DirectorOp = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      text,
      status: "running",
      module,
      tag,
    };
    setOps((previous) => [...previous, op].slice(-MAX_OPS));
    opsTouched.current = true;
    return op.id;
  }, []);

  const resolveOp = useCallback(
    (id: string, status: Exclude<DirectorOpStatus, "running">, text?: string) => {
      setOps((previous) =>
        previous.map((op) => (op.id === id ? { ...op, status, text: text ?? op.text } : op))
      );
    },
    []
  );

  const clearOps = useCallback(() => setOps([]), []);

  // Register the ledger sink for the orchestrator.
  useEffect(() => {
    ledgerSink.log = log;
    ledgerSink.resolveOp = resolveOp;
    return () => {
      ledgerSink.log = () => "";
      ledgerSink.resolveOp = () => {};
    };
  }, [log, resolveOp]);

  // Any ledger activity while the console is shut pulls it open —
  // the ledger is a live instrument, not a log file you must remember to read.
  useEffect(() => {
    if (!opsTouched.current) return;
    opsTouched.current = false;
    setConsoleOpen(true);
  }, [ops]);

  const setActive = useCallback((next: boolean) => {
    setActiveState((current) => {
      if (current === next) return current;
      document.documentElement.dataset.director = next ? "on" : "off";
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // Preference simply won't persist.
      }
      playChime(next);
      log(next ? "DIRECTOR MODE ENGAGED — full studio matrix access granted." : "Director Mode disengaged — standard workspace authority restored.");
      if (next) setConsoleOpen(true);
      return next;
    });
  }, [log]);

  const setRequestPhase = useCallback(
    (
      phase: WorkspaceRequestPhase,
      details?: { provider?: string | null; outputCharacters?: number }
    ) => {
      const now = Date.now();
      setRequestActivity((current) => ({
        phase,
        requestId: phase === "preflight" ? crypto.randomUUID() : current.requestId,
        startedAt: phase === "preflight" ? now : current.startedAt,
        updatedAt: now,
        provider:
          details?.provider === undefined ? current.provider : details.provider,
        outputCharacters:
          details?.outputCharacters === undefined
            ? current.outputCharacters
            : Math.max(0, details.outputCharacters),
      }));
    },
    []
  );

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const toggle = useCallback(() => setActive(!activeRef.current), [setActive]);

  const value = useMemo<DirectorContextValue>(
    () => ({
      active,
      toggle,
      ops,
      log,
      resolveOp,
      clearOps,
      consoleOpen,
      setConsoleOpen,
      busy,
      setBusy,
      requestActivity,
      setRequestPhase,
    }),
    [active, toggle, ops, log, resolveOp, clearOps, consoleOpen, busy, requestActivity, setRequestPhase]
  );

  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>;
}

export function useDirector(): DirectorContextValue {
  const ctx = useContext(DirectorContext);
  if (!ctx) {
    // Fallback so studio pages never crash outside the provider.
    return {
      active: false,
      toggle: () => {},
      ops: [],
      log: () => "",
      resolveOp: () => {},
      clearOps: () => {},
      consoleOpen: false,
      setConsoleOpen: () => {},
      busy: false,
      setBusy: () => {},
      requestActivity: {
        phase: "idle",
        requestId: null,
        startedAt: null,
        updatedAt: 0,
        provider: null,
        outputCharacters: 0,
      },
      setRequestPhase: () => {},
    };
  }
  return ctx;
}
