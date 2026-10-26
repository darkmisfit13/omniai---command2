"use client";

import { useDirector } from "@/lib/directorMode";
import { DIRECTOR_MODULES } from "@/lib/directorOrchestrator";

/**
 * DIRECTOR MODE — tactile control module.
 *
 * A physical-feeling switch: beveled track, ridged thumb, status LED,
 * engagement rings on hover/focus, and a synthesized confirmation chime
 * (from the Director context) on every flip. Shown in two cuts:
 *   - `bar` — compact, rides the top utility bar,
 *   - `rail` — full-width card for the sidebar.
 *
 * Hover reveals the live metrics of what the mode actually grants:
 * full studio-matrix reach and the operations ledger.
 */

const MODULE_COUNT = Object.keys(DIRECTOR_MODULES).length;

function useSwitchModel() {
  const { active, toggle, ops, busy, setConsoleOpen } = useDirector();
  const completed = ops.filter((op) => op.status !== "running").length;
  return { active, toggle, completed, busy, setConsoleOpen };
}

function SwitchMechanism({
  active,
  toggle,
  busy,
  compact,
}: {
  active: boolean;
  toggle: () => void;
  busy: boolean;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Disengage Director Mode" : "Engage Director Mode"}
      onClick={toggle}
      className={`syn-director-switch ${active ? "is-on" : ""} ${
        compact ? "syn-director-switch--compact" : ""
      }`}
    >
      <span className="syn-director-switch__track" aria-hidden="true">
        <span className="syn-director-switch__grooves" aria-hidden="true" />
        <span className="syn-director-switch__thumb" aria-hidden="true">
          <span className="syn-director-switch__led" aria-hidden="true" />
        </span>
      </span>
      <span className="syn-director-switch__labels" aria-hidden="true">
        <span className="syn-director-switch__label">DIRECTOR MODE</span>
        <span className="syn-director-switch__state dms-mono">
          {busy ? "EXECUTING" : active ? "ENGAGED" : "STANDBY"}
        </span>
      </span>
    </button>
  );
}

function MetricsTooltip({ active, completed }: { active: boolean; completed: number }) {
  return (
    <span className="syn-director-metrics" role="tooltip">
      <span className="syn-director-metrics__row">
        <span className="syn-director-metrics__dot" aria-hidden="true" />
        {active ? "FULL SYSTEM ACCESS" : "STANDARD AUTHORITY"}
      </span>
      <span className="syn-director-metrics__row">{MODULE_COUNT} MODULES IN MATRIX</span>
      <span className="syn-director-metrics__row">{completed} OPS LOGGED THIS SESSION</span>
      <span className="syn-director-metrics__row syn-director-metrics__row--dim">
        LEDGER: {active ? "LIVE" : "OFFLINE"}
      </span>
    </span>
  );
}

export function DirectorSwitchBar() {
  const model = useSwitchModel();
  return (
    <div className="syn-director-host syn-director-host--bar">
      <SwitchMechanism
        active={model.active}
        toggle={model.toggle}
        busy={model.busy}
        compact
      />
      <MetricsTooltip active={model.active} completed={model.completed} />
    </div>
  );
}

export function DirectorSwitchRail() {
  const model = useSwitchModel();
  return (
    <div className="syn-director-host syn-director-host--rail">
      <div className="syn-director-rail__head">
        <span className="syn-director-rail__title dms-mono">EXECUTIVE CONTROL</span>
        {model.active && model.completed > 0 && (
          <button
            type="button"
            onClick={() => model.setConsoleOpen(true)}
            className="syn-director-rail__ledger"
            title="Open the Live Operations Console"
          >
            {model.completed} OPS ▸
          </button>
        )}
      </div>
      <SwitchMechanism
        active={model.active}
        toggle={model.toggle}
        busy={model.busy}
        compact={false}
      />
      <p className="syn-director-rail__hint">
        {model.active
          ? `Autonomy online — the AI Director can chain all ${MODULE_COUNT} studio modules from the main chat.`
          : "Flip to hand the AI Director chained access across the whole studio matrix."}
      </p>
      <MetricsTooltip active={model.active} completed={model.completed} />
    </div>
  );
}
