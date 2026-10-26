"use client";

import { useEffect, useRef } from "react";
import { useDirector, type DirectorOp } from "@/lib/directorMode";

/**
 * Live Operations Console — the Director's ledger.
 *
 * An animated slide-out terminal that maps, in real time, exactly what
 * the AI Director is executing: "[Director Mode Active]: Extracting Audio
 * Stems…". Entries stream in as the orchestrator advances, running steps
 * carry a spinner, and the panel pulls itself open the moment anything
 * logs. When dismissed it collapses to a live OPS pill that keeps counting.
 */

const STATUS_GLYPH: Record<DirectorOp["status"], string> = {
  running: "▸",
  ok: "✔",
  warn: "!",
  error: "✕",
};

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function DirectorConsole() {
  const { active, ops, consoleOpen, setConsoleOpen, clearOps } = useDirector();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ops, consoleOpen]);

  // The console only exists for the Director; fold it away on disengage.
  useEffect(() => {
    if (!active) setConsoleOpen(false);
  }, [active, setConsoleOpen]);

  if (!active) return null;

  const running = ops.filter((op) => op.status === "running").length;

  if (!consoleOpen) {
    return (
      <button
        type="button"
        onClick={() => setConsoleOpen(true)}
        className="syn-director-console-pill"
        title="Open the Live Operations Console"
      >
        <span className="syn-director-console-pill__dot" aria-hidden="true" />
        <span className="dms-mono">OPS {ops.length}</span>
        {running > 0 && <span className="dms-mono syn-director-console-pill__run">· {running} LIVE</span>}
      </button>
    );
  }

  return (
    <aside
      className="syn-director-console"
      aria-label="Director Mode live operations console"
    >
      <header className="syn-director-console__head">
        <span className="syn-director-console__title dms-mono">
          <span className="syn-director-console__dot" aria-hidden="true" />
          DIRECTOR OPS LEDGER
        </span>
        <span className="syn-director-console__meta dms-mono">
          {running > 0 ? `${running} LIVE` : `${ops.length} OPS`}
        </span>
        <div className="syn-director-console__actions">
          <button type="button" onClick={clearOps} className="syn-director-console__btn" title="Clear ledger">
            CLEAR
          </button>
          <button
            type="button"
            onClick={() => setConsoleOpen(false)}
            className="syn-director-console__btn"
            aria-label="Collapse operations console"
            title="Collapse"
          >
            ▾
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="syn-director-console__body" role="log" aria-live="polite">
        {ops.length === 0 && (
          <p className="syn-director-console__empty dms-mono">
            [Director Mode Active]: standing by for macro instruction…
          </p>
        )}
        {ops.map((op) => (
          <div key={op.id} className={`syn-director-console__row is-${op.status}`}>
            <span className="syn-director-console__ts dms-mono">{clock(op.ts)}</span>
            <span className={`syn-director-console__glyph${op.status === "running" ? " is-spinning" : ""}`} aria-hidden="true">
              {STATUS_GLYPH[op.status]}
            </span>
            <span className="syn-director-console__text dms-mono">
              <span className="syn-director-console__prefix">[{op.tag ?? "Director Mode Active"}]:</span> {op.text}
              {op.module && <span className="syn-director-console__module"> ({op.module})</span>}
            </span>
          </div>
        ))}
      </div>

      <footer className="syn-director-console__foot dms-mono">
        STUDIO MATRIX LINK: <b>ONLINE</b> · HANDOFF BUS: <b>ARMED</b> · AUTHORITY: SIGNED-IN USER
      </footer>
    </aside>
  );
}
