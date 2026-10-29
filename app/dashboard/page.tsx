
"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HoloOrb from "@/components/HoloOrb";
import { supabase } from "@/lib/supabaseClient";
import { environmentAreas } from "@/lib/environment-areas";
import DisplaySurface from "../hud/DisplaySurface";


type OllamaResult = {
  reachable: boolean;
  models: string[];
  llama32Installed: boolean;
  reason?: string;
};

type Provider = { name: string; enabled: boolean };

type SupabaseResult = {
  status: "connected" | "check-failed";
  detail: string;
};

type ProviderResult = { providers: Provider[]; error?: string };
type SignalState = "busy" | "good" | "bad" | "idle";

/**
 * Result of the approval safeguard check. It reads the approval queue the same
 * way /approvals does: if the table answers, the governance safeguard is in
 * place, and the pending count tells the customer what is waiting on them.
 */
type SafeguardResult = { ok: boolean; pending: number; detail: string };

/** One row of the approval queue as the dashboard's queue panel lists it. */
type QueueItem = { id: string; action: string; created_at: string };

/**
 * Shape returned by /api/command-center.
 *
 * Fields are nullable on purpose. The billing numbers arrive with the migration
 * that creates the ledger, and `null` is what lets the panel say "not set up
 * yet" rather than rendering a confident zero it cannot justify.
 */
type CommandCenterReadout = {
  generatedAt: string;
  available: { media: boolean; alerts: boolean; conversations: boolean; messages: boolean; billing: boolean; creditHistory: boolean; projects: boolean };
  totals: {
    assets24h: number | null;
    conversations24h: number | null;
    messagesLastHour: number | null;
    projects24h: number;
    alerts24h: number;
    spentCredits24h: number | null;
    balance: number | null;
  };
  systems: { id: string; label: string; to: string; assets: number | null; last24h: number | null }[];
  hourly: number[] | null;
  providers: { id: string; count: number }[] | null;
  alerts: { pipeline: string; provider: string; reason: string }[] | null;
};

const statePalette: Record<SignalState, string> = {
  good: "#6ee7b7",
  bad: "#fb7185",
  busy: "#00f2fe",
  idle: "#b9a0ff",
};

const shortcuts = [
  {
    code: "AI",
    title: "AI workspace",
    description: "Plan, write, reason, and work with your AI.",
    href: "/",
    label: "Open workspace",
  },
  {
    code: "IO",
    title: "Local diagnostics",
    description: "Inspect your local AI service.",
    href: "/local-diagnostics",
    label: "Inspect system",
  },
  {
    code: "OK",
    title: "Review proposals",
    description: "Check drafts and approval requirements.",
    href: "/approvals",
    label: "Review items",
  },
];

function providerName(name: string) {
  const names: Record<string, string> = {
    groq: "Groq",
    gemini: "Gemini",
    claude: "Claude",
    gpt: "OpenAI GPT",
    ollama: "Ollama",
  };

  return names[name.toLowerCase()] ?? name;
}

/** Compact "12m ago" caption for queue rows. */
function ago(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Status waveform for a system-health row. The shape reads the check state —
 * a steady high wave for healthy, a flat low trace for failed, a running
 * zig-zag while a check is in flight. It is a state indicator, not history.
 */
/**
 * LiveChart — animated canvas chart matching image 2 style.
 * Flat line for bad/disconnected, area chart with glowing bars for active.
 */
function SignalCore({
  active,
  strands,
  meta,
}: {
  active: boolean;
  strands: Strand[];
  /** 24-hour tally printed under the canvas once the readout has loaded. */
  meta?: string;
}) {
  return (
    <section className={`omni-core ${active ? "is-active" : ""}`}>
      <div className="omni-core-canvas">
        <HoloOrb
          className="omni-dashboard-holo-orb w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96"
          size="hero"
          phase={active ? "thinking" : "idle"}
          showLabel={false}
        />

        {/* Title rides inside the graphic, upper-left, like the reference deck. */}
        <div className="omni-core-canvas-head">
          <div className="omni-core-canvas-title">
            <i aria-hidden="true" />
            OmniAI · Activity Core
          </div>
        </div>
      </div>

      {meta && <p className="omni-core-tally">{meta}</p>}

      <div className="omni-core-footer">
        <div className="omni-core-legend" aria-label="Signal strand per system">
          {strands.map((strand) => (
            <span
              key={strand.label}
              className="omni-legend-item"
              style={{
                color: strand.color,
                opacity: 0.55 + Math.min(1, strand.level) * 0.45,
              }}
            >
              <i
                style={{
                  background: strand.color,
                  boxShadow: `0 0 7px ${strand.color}99`,
                }}
              />
              {strand.label}
            </span>
          ))}
        </div>
        <span className="omni-core-mode">
          {active ? "LIVE CHECK ACTIVITY" : "VISUALIZATION READY"}
        </span>
      </div>
    </section>
  );
}

type Strand = { color: string; level: number; label: string };

export default function DashboardPage() {
  const router = useRouter();
  const [loadingShortcut, setLoadingShortcut] = useState<string | null>(null);

  const handleShortcutClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setLoadingShortcut(href);
    setTimeout(() => {
      router.push(href);
    }, 240);
  };

  const [checkingOllama, setCheckingOllama] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<OllamaResult | null>(null);
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [supabaseResult, setSupabaseResult] = useState<SupabaseResult | null>(null);
  const [providerResult, setProviderResult] = useState<ProviderResult | null>(null);
  const [checkingSafeguards, setCheckingSafeguards] = useState(false);
  const [safeguardResult, setSafeguardResult] = useState<SafeguardResult | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const automaticCheckStarted = useRef(false);
  const [operator, setOperator] = useState<string | null>(null);

  // Live readout for the activity panels. Fetched rather than derived from
  // the diagnostics above because those answer "is the platform healthy" and
  // this answers "what have you actually made" — different questions, and only
  // one of them changes while the page is open.
  const [command, setCommand] = useState<CommandCenterReadout | null>(null);
  const [commandUnavailable, setCommandUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCommandCenter() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setCommandUnavailable(true);
        return;
      }

      const response = await fetch("/api/command-center", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).catch(() => null);

      if (cancelled) return;
      if (!response?.ok) {
        setCommandUnavailable(true);
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!cancelled && payload && typeof payload === "object" && "totals" in payload) {
        setCommand(payload as CommandCenterReadout);
      } else if (!cancelled) {
        setCommandUnavailable(true);
      }
    }

    void loadCommandCenter();
    return () => {
      cancelled = true;
    };
  }, []);

  // The core greets whoever is signed in. Supabase holds a display name if one
  // was ever set at signup; otherwise fall back to the handle inside the email
  // address so the line never renders without one.
  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled || !data.user) return;

        const user = data.user;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const named = [meta.display_name, meta.full_name, meta.name].find(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        );

        const fromEmail = (user.email ?? "").split("@")[0];
        const handle = (named ?? fromEmail ?? "").trim();
        if (!handle) return;

        setOperator(handle.charAt(0).toUpperCase() + handle.slice(1));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true);
    setOllamaResult(null);

    // Local diagnostics are intentionally unavailable in hosted deployments
    // (the route returns 404 when VERCEL=1). Skip the call there so we do not
    // spam the console with a 404 or surface a misleading failure.
    if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setOllamaResult({
        reachable: false,
        models: [],
        llama32Installed: false,
        reason: "Local diagnostics are only available when running OmniAI on your laptop (localhost).",
      });
      setCheckingOllama(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw new Error("Could not verify your OmniAI session.");

      const token = data.session?.access_token;

      if (!token) throw new Error("Sign in to OmniAI first.");

      const response = await fetch("/api/local-diagnostics", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "ollama" }),
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not check Ollama.");
      }

      setOllamaResult({
        reachable: Boolean(result.reachable),
        models: Array.isArray(result.models) ? result.models : [],
        llama32Installed: Boolean(result.llama32Installed),
        reason: typeof result.reason === "string" ? result.reason : undefined,
      });
    } catch (cause) {
      setOllamaResult({
        reachable: false,
        models: [],
        llama32Installed: false,
        reason:
          cause instanceof Error
            ? cause.message
            : "Could not check Ollama.",
      });
    } finally {
      setCheckingOllama(false);
    }
  }, []);

  const checkConnections = useCallback(async () => {
    setCheckingConnections(true);
    setSupabaseResult(null);
    setProviderResult(null);

    try {
      const [personaResponse, providersResponse] = await Promise.all([
        supabase.from("persona").select("id").limit(1),
        supabase.from("providers").select("name, enabled"),
      ]);

      const personaWorks = !personaResponse.error;
      const providersWork = !providersResponse.error;

      setSupabaseResult(
        personaWorks || providersWork
          ? {
              status: "connected",
              detail:
                personaWorks && providersWork
                  ? "Both database requests succeeded."
                  : "At least one request succeeded; another needs review.",
            }
          : {
              status: "check-failed",
              detail:
                "Database requests failed. Check your session, configuration, permissions, and service availability.",
            },
      );

      if (providersResponse.error) {
        setProviderResult({
          providers: [],
          error:
            "Could not read provider settings. Check sign-in and database permissions.",
        });
      } else {
        const rows = Array.isArray(providersResponse.data)
          ? providersResponse.data
          : [];

        setProviderResult({
          providers: rows.filter(
            (item): item is Provider =>
              typeof item?.name === "string" &&
              typeof item?.enabled === "boolean",
          ),
        });
      }
    } catch {
      setSupabaseResult({
        status: "check-failed",
        detail: "Could not complete the Supabase connection check.",
      });

      setProviderResult({
        providers: [],
        error: "Could not load provider settings.",
      });
    } finally {
      setCheckingConnections(false);
    }
  }, []);

  /**
   * The approval safeguard registers itself by answering. Reading the pending
   * count and the first rows from the same queue /approvals reviews both proves
   * the safeguard is in place and tells the customer what is waiting on them.
   */
  const checkSafeguards = useCallback(async () => {
    setCheckingSafeguards(true);
    setSafeguardResult(null);
    setQueueError(null);

    try {
      const [countResult, itemsResult] = await Promise.all([
        supabase
          .from("approval_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("approval_queue")
          .select("id, action, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      if (countResult.error) throw new Error(countResult.error.message);

      const pending = countResult.count ?? 0;

      setSafeguardResult({
        ok: true,
        pending,
        detail:
          pending === 0
            ? "Approval queue reachable — nothing waiting on you."
            : `Approval queue reachable — ${pending} item${pending === 1 ? "" : "s"} awaiting review.`,
      });

      if (itemsResult.error) {
        setQueue([]);
        setQueueError("The safeguard answered, but listing the queue rows failed.");
      } else {
        setQueue(Array.isArray(itemsResult.data) ? itemsResult.data : []);
      }
    } catch (cause) {
      setSafeguardResult({
        ok: false,
        pending: 0,
        detail:
          cause instanceof Error && cause.message.trim()
            ? cause.message
            : "Could not read the approval queue. Check your session and database permissions.",
      });
      setQueue(null);
      setQueueError(
        cause instanceof Error && cause.message.trim()
          ? cause.message
          : "Could not read the approval queue.",
      );
    } finally {
      setCheckingSafeguards(false);
    }
  }, []);

  useEffect(() => {
    if (automaticCheckStarted.current) return;

    automaticCheckStarted.current = true;
    void checkOllama();
    void checkConnections();
    void checkSafeguards();
  }, [checkOllama, checkConnections, checkSafeguards]);

  const isBusy = checkingOllama || checkingConnections || checkingSafeguards;

  const recheckAll = useCallback(() => {
    void checkOllama();
    void checkConnections();
    void checkSafeguards();
  }, [checkOllama, checkConnections, checkSafeguards]);

  const enabledProviders =
    providerResult?.providers.filter((provider) => provider.enabled) ?? [];

  const localState: SignalState = checkingOllama
    ? "busy"
    : !ollamaResult
      ? "idle"
      : ollamaResult.reachable
        ? "good"
        : "bad";

  const databaseState: SignalState = checkingConnections
    ? "busy"
    : !supabaseResult
      ? "idle"
      : supabaseResult.status === "connected"
        ? "good"
        : "bad";

  const providerState: SignalState = checkingConnections
    ? "busy"
    : !providerResult
      ? "idle"
      : providerResult.error
        ? "bad"
        : "good";

  const safeguardState: SignalState = checkingSafeguards
    ? "busy"
    : !safeguardResult
      ? "idle"
      : safeguardResult.ok
        ? "good"
        : "bad";

  // Amplitude each system contributes to the wavelength mesh.
  const levelFor = (state: SignalState) =>
    state === "busy" ? 1 : state === "bad" ? 0.8 : state === "good" ? 0.6 : 0.22;

  const strands: Strand[] = [
    { label: "Local AI", color: statePalette[localState], level: levelFor(localState) },
    { label: "Database", color: statePalette[databaseState], level: levelFor(databaseState) },
    { label: "Providers", color: statePalette[providerState], level: levelFor(providerState) },
    { label: "Safeguards", color: statePalette[safeguardState], level: levelFor(safeguardState) },
  ];

  const models = ollamaResult?.models ?? [];
  const providersTotal = providerResult?.providers.length ?? 0;

  const states: SignalState[] = [localState, databaseState, providerState, safeguardState];
  const passingChecks = states.filter((state) => state === "good").length;

  const healthColor: string =
    passingChecks === 4
      ? statePalette.good
      : passingChecks === 0
        ? statePalette.bad
        : "#a78bfa";

  /** One row per register — the health panel, with its own recheck key. */
  const healthRows = [
    {
      key: "local",
      icon: "⌁",
      name: "Local AI",
      state: localState,
      href: "/local-diagnostics",
      status: checkingOllama
        ? "Checking"
        : !ollamaResult
          ? "Not checked"
          : ollamaResult.reachable
            ? "Responding"
            : "Unavailable",
      detail: !ollamaResult
        ? "Ollama connection status"
        : ollamaResult.reachable
          ? `${ollamaResult.models.length} model${ollamaResult.models.length === 1 ? "" : "s"} installed · Ollama`
          : ollamaResult.reason ?? "Ollama is not reachable.",
      check: checkOllama,
      busy: checkingOllama,
    },
    {
      key: "database",
      icon: "▣",
      name: "Database",
      state: databaseState,
      href: "/database",
      status: checkingConnections
        ? "Checking"
        : !supabaseResult
          ? "Not checked"
          : supabaseResult.status === "connected"
            ? "Connected"
            : "Check failed",
      detail: supabaseResult?.detail ?? "Supabase connection status",
      check: checkConnections,
      busy: checkingConnections,
    },
    {
      key: "providers",
      icon: "⇄",
      name: "AI providers",
      state: providerState,
      href: "/environment",
      status: checkingConnections
        ? "Checking"
        : !providerResult
          ? "Not checked"
          : providerResult.error
            ? "Settings unreadable"
            : `${enabledProviders.length} enabled`,
      detail: providerResult?.error
        ? providerResult.error
        : providerResult
          ? `${enabledProviders.length} of ${providerResult.providers.length} provider records enabled · settings only, no live calls`
          : "Provider configuration",
      check: checkConnections,
      busy: checkingConnections,
    },
    {
      key: "safeguards",
      icon: "✦",
      name: "Approval safeguards",
      state: safeguardState,
      href: "/approvals",
      status: checkingSafeguards
        ? "Checking"
        : !safeguardResult
          ? "Not checked"
          : safeguardResult.ok
            ? safeguardResult.pending > 0
              ? `${safeguardResult.pending} pending`
              : "In place"
            : "Check failed",
      detail: safeguardResult?.detail ?? "Approvals required before action",
      check: checkSafeguards,
      busy: checkingSafeguards,
    },
  ];

  /** Everything that wants the operator's eyes, worst first. */
  const alerts: {
    key: string;
    tone: "critical" | "warning" | "note";
    title: string;
    sub: string;
    to: string;
  }[] = [];

  if (databaseState === "bad") {
    alerts.push({
      key: "db",
      tone: "critical",
      title: "Database check failed",
      sub: supabaseResult?.detail ?? "Database requests failed.",
      to: "/database",
    });
  }

  if (safeguardState === "bad") {
    alerts.push({
      key: "safeguards",
      tone: "critical",
      title: "Safeguard check failed",
      sub: safeguardResult?.detail ?? "Could not read the approval queue.",
      to: "/approvals",
    });
  }

  if (localState === "bad") {
    alerts.push({
      key: "local",
      tone: "warning",
      title: "Local AI unreachable",
      sub: ollamaResult?.reason ?? "Ollama is not reachable.",
      to: "/local-diagnostics",
    });
  }

  if (providerState === "bad") {
    alerts.push({
      key: "providers",
      tone: "warning",
      title: "Provider settings unreadable",
      sub: providerResult?.error ?? "Could not read provider settings.",
      to: "/environment",
    });
  }

  if (command) {
    const reasonText: Record<string, string> = {
      quota: "Quota reached",
      missing_key: "API key missing",
      error: "Provider error",
    };

    command.alerts?.forEach((alert, index) => {
      alerts.push({
        key: `gen-${alert.pipeline}-${alert.provider}-${index}`,
        tone: alert.reason === "quota" ? "critical" : alert.reason === "missing_key" ? "warning" : "note",
        title: `${providerName(alert.provider)} · ${alert.pipeline}`,
        sub: reasonText[alert.reason] ?? alert.reason,
        to: "/audit-log",
      });
    });
  }

  const visibleAlerts = alerts.slice(0, 6);
  const peakHourly = command?.hourly ? Math.max(1, ...command.hourly) : 1;

  return (
    <main className="omni-dashboard">
      <div className="omni-welcome">
        <p className="omni-welcome__name">
          Welcome{operator ? `, ${operator}` : ""}
        </p>
        <p className="omni-welcome__sub">OmniAI - Command Center</p>
      </div>

      <section className="omni-hero">
        <div className="omni-orb orb-a" aria-hidden="true" />
        <div className="omni-orb orb-b" aria-hidden="true" />

        <div className="omni-hero-grid">
          <SignalCore
            active={isBusy}
            strands={strands}
            meta={
              command
                ? `${command.totals.assets24h?.toLocaleString() ?? "Unavailable"} assets · ${command.totals.conversations24h?.toLocaleString() ?? "Unavailable"} conversations / 24h`
                : undefined
            }
          />

          <div className="omni-intro">
            <p className="omni-label">
              OMNIAI <span>/</span> SYSTEM OVERVIEW
            </p>

            <div className="omni-hero-actions">
              <Link href="/" className="omni-button primary">
                <span>AI</span> Open AI workspace <b>↗</b>
              </Link>
              <Link href="/local-diagnostics" className="omni-button quiet">
                <span>⌁</span> System diagnostics
              </Link>
            </div>

            <div className="omni-live-note">
              <span className={`live-dot ${isBusy ? "busy" : ""}`} />
              {isBusy ? "System checks in progress" : "Command interface ready"}
            </div>
          </div>
        </div>
      </section>

      {/* ---- command deck: KPI tiles, routing map, queue, cost pulse ---- */}
      <section className="omni-section">
        <div className="omni-section-heading">
          <div>
            <p className="omni-label">
              COMMAND <span>/</span> CENTER
            </p>
            <h2>Dashboard</h2>
            <p>
              What your systems answered, what is waiting on you, and what the
              last 24 hours cost.
            </p>
          </div>

          <span className={`omni-section-count ${isBusy ? "busy" : ""}`}>
            <i />
            {command
              ? `UPDATED ${new Date(command.generatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : commandUnavailable ? "UNAVAILABLE" : "LOADING"}
          </span>
        </div>

        <div className="omni-kpis">
          <article className="omni-kpi">
            <DisplaySurface accent="#00f2fe" state={command ? "good" : "idle"} seed={11} />
            <div className="omni-kpi-head">
              <span className="omni-kpi-icon" style={{ color: "#00f2fe" }} aria-hidden="true">
                ◈
              </span>
              <p className="omni-label">ASSETS · 24H</p>
            </div>
            <strong className="omni-kpi-value">
              <DisplaySurface variant="well" accent="#00f2fe" state={command ? "good" : "idle"} seed={41} />
              <span>{command?.totals.assets24h?.toLocaleString() ?? "—"}</span>
            </strong>
            <small className="omni-kpi-note">
              {command
                ? `${command.totals.conversations24h?.toLocaleString() ?? "Unavailable"} conversations in the last 24 hours`
                : "Reading the last 24 hours…"}
            </small>
            <div className="omni-kpi-foot">
              <Link href="/studio/image-studio" className="omni-kpi-link">
                Open Image Studio <span>↗</span>
              </Link>
            </div>
          </article>

          <article className="omni-kpi">
            <DisplaySurface
              accent={healthColor}
              state={isBusy ? "busy" : passingChecks === 4 ? "good" : passingChecks === 0 ? "bad" : "idle"}
              seed={12}
            />
            <div className="omni-kpi-head">
              <span className="omni-kpi-icon" style={{ color: healthColor }} aria-hidden="true">
                ⬡
              </span>
              <p className="omni-label">SYSTEM HEALTH</p>
            </div>
            <strong className="omni-kpi-value">
              <DisplaySurface
                variant="well"
                accent={healthColor}
                state={isBusy ? "busy" : passingChecks === 4 ? "good" : passingChecks === 0 ? "bad" : "idle"}
                seed={42}
              />
              <span>
                {isBusy && passingChecks === 0 ? "···" : `${passingChecks}/4`}
              </span>
            </strong>
            <small className="omni-kpi-note">
              {isBusy && passingChecks === 0
                ? "Running the first checks"
                : `${passingChecks} of 4 systems answered the last check`}
            </small>
            <div className="omni-kpi-foot">
              <button
                type="button"
                className="omni-kpi-link"
                onClick={recheckAll}
                disabled={isBusy}
              >
                {isBusy ? "Checking…" : "Recheck all"}
              </button>
            </div>
          </article>

          <article className="omni-kpi">
            <DisplaySurface
              accent={statePalette[safeguardState]}
              state={safeguardState}
              seed={13}
            />
            <div className="omni-kpi-head">
              <span className="omni-kpi-icon" style={{ color: statePalette[safeguardState] }} aria-hidden="true">
                ✦
              </span>
              <p className="omni-label">APPROVAL SAFEGUARDS</p>
            </div>
            <strong className="omni-kpi-value">
              <DisplaySurface variant="well" accent={statePalette[safeguardState]} state={safeguardState} seed={43} />
              <span>
                {checkingSafeguards
                  ? "···"
                  : !safeguardResult
                    ? "—"
                    : safeguardResult.ok
                      ? String(safeguardResult.pending)
                      : "ERR"}
              </span>
            </strong>
            <small className="omni-kpi-note">
              {safeguardResult?.detail ?? "Approvals required before action"}
            </small>
            <div className="omni-kpi-foot">
              <Link href="/approvals" className="omni-kpi-link">
                Open approvals <span>↗</span>
              </Link>
            </div>
          </article>

          <article className="omni-kpi">
            <DisplaySurface
              accent={statePalette[localState]}
              state={localState}
              seed={14}
            />
            <div className="omni-kpi-head">
              <span className="omni-kpi-icon" style={{ color: statePalette[localState] }} aria-hidden="true">
                ⌁
              </span>
              <p className="omni-label">LOCAL AI</p>
            </div>
            <strong className="omni-kpi-value">
              <DisplaySurface variant="well" accent={statePalette[localState]} state={localState} seed={44} />
              <span>
                {checkingOllama ? "···" : ollamaResult?.reachable ? String(models.length) : "—"}
              </span>
            </strong>
            <small className="omni-kpi-note">
              {checkingOllama
                ? "Inspecting local service"
                : ollamaResult?.reachable
                  ? `${models.length} model${models.length === 1 ? "" : "s"} installed`
                  : ollamaResult?.reason ?? "Ollama connection status"}
            </small>
            <div className="omni-kpi-foot">
              <Link href="/local-diagnostics" className="omni-kpi-link">
                Open diagnostics <span>↗</span>
              </Link>
            </div>
          </article>
        </div>

        <div className="omni-board">
          {/* ---- request routing map ---- */}
          <section className="omni-panel omni-route">
            <DisplaySurface accent="#a78bfa" state={isBusy ? "busy" : "idle"} seed={21} />
            <header className="omni-panel-head">
              <div>
                <p className="omni-label">
                  REQUEST <span>/</span> ROUTING
                </p>
                <h3>How work flows through your OmniAI</h3>
              </div>
              <span className={`omni-section-count ${isBusy ? "busy" : ""}`}>
                <i />
                ROUTING MAP
              </span>
            </header>

            <svg
              className="omni-route-svg"
              viewBox="0 0 900 280"
              role="img"
              aria-label="How work flows through OmniAI: Intake to OmniAI, splits to Local Providers and Cloud Providers, cross-connected, both converge to Approvals/Tools, then Output."
            >
              <defs>
                {/* Animated mesh gradient for each path */}
                <linearGradient id="rg-intake" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9"/>
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.5"/>
                </linearGradient>
                <linearGradient id="rg-local" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6"/>
                  <stop offset="100%" stopColor={statePalette[localState]} stopOpacity="0.9"/>
                </linearGradient>
                <linearGradient id="rg-cloud" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6"/>
                  <stop offset="100%" stopColor={statePalette[providerState]} stopOpacity="0.9"/>
                </linearGradient>
                <linearGradient id="rg-cross" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4facfe" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#4facfe" stopOpacity="0.4"/>
                </linearGradient>
                <linearGradient id="rg-approvals" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={statePalette[safeguardState]} stopOpacity="0.7"/>
                  <stop offset="100%" stopColor={statePalette[safeguardState]} stopOpacity="0.9"/>
                </linearGradient>
                <filter id="rf-glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                {/* Wave mask for the mesh strands */}
                <clipPath id="rc-left"><rect x="0" y="0" width="450" height="280"/></clipPath>
                <clipPath id="rc-right"><rect x="450" y="0" width="450" height="280"/></clipPath>
              </defs>

              {/* ── BACKGROUND PLATE indentation ── */}
              <rect x="10" y="10" width="880" height="260" rx="14" ry="14"
                fill="url(#plate-bg)" stroke="rgba(167,139,250,0.18)" strokeWidth="1"/>
              <defs>
                <linearGradient id="plate-bg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#07050f"/>
                  <stop offset="100%" stopColor="#0d0a1a"/>
                </linearGradient>
              </defs>
              {/* Inner inset shadow lines */}
              <rect x="10" y="10" width="880" height="260" rx="14" ry="14"
                fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
              <rect x="13" y="13" width="874" height="254" rx="12" ry="12"
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>

              {/* ── WAVE STRAND LAYERS (wide, blurred, image-1 style) ── */}
              {/* Intake → OmniAI: primary violet wave (3 strands) */}
              <g filter="url(#rf-glow)" opacity="0.85" className="omni-route-wave-group">
                <path d="M80 140 C120 140,160 140,220 140" fill="none" stroke="#a78bfa" strokeWidth="18" strokeLinecap="round" opacity="0.12"/>
                <path d="M80 140 C120 132,165 148,220 140" fill="none" stroke="#a78bfa" strokeWidth="8" strokeLinecap="round" opacity="0.45" className="omni-route-wave"/>
                <path d="M80 140 C120 148,165 132,220 140" fill="none" stroke="#c4b5fd" strokeWidth="4" strokeLinecap="round" opacity="0.6" className="omni-route-wave omni-route-wave--b"/>
                <path d="M80 140 C120 140,165 140,220 140" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* OmniAI → Local (upper): RED = disconnected */}
              <g filter="url(#rf-glow)" opacity="0.9" className="omni-route-wave-group">
                <path d="M310 140 C350 140,390 80,440 80" fill="none" stroke={statePalette[localState]} strokeWidth="16" strokeLinecap="round" opacity="0.10"/>
                <path d="M310 140 C350 138,395 74,440 80" fill="none" stroke={statePalette[localState]} strokeWidth="7" strokeLinecap="round" opacity="0.5" className="omni-route-wave"/>
                <path d="M310 140 C350 142,390 86,440 80" fill="none" stroke={statePalette[localState]} strokeWidth="3.5" strokeLinecap="round" opacity="0.65" className="omni-route-wave omni-route-wave--b"/>
                <path d="M310 140 C350 140,390 80,440 80" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* OmniAI → Cloud (lower): GREEN = live */}
              <g filter="url(#rf-glow)" opacity="0.9" className="omni-route-wave-group">
                <path d="M310 140 C350 140,390 200,440 200" fill="none" stroke={statePalette[providerState]} strokeWidth="16" strokeLinecap="round" opacity="0.10"/>
                <path d="M310 140 C350 142,395 206,440 200" fill="none" stroke={statePalette[providerState]} strokeWidth="7" strokeLinecap="round" opacity="0.5" className="omni-route-wave"/>
                <path d="M310 140 C350 138,390 194,440 200" fill="none" stroke={statePalette[providerState]} strokeWidth="3.5" strokeLinecap="round" opacity="0.65" className="omni-route-wave omni-route-wave--b"/>
                <path d="M310 140 C350 140,390 200,440 200" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* Cross-connect: Local ↔ Cloud (vertical, BLUE) */}
              <g filter="url(#rf-glow)" opacity="0.75">
                <path d="M460 80 C460 110,460 170,460 200" fill="none" stroke="#4facfe" strokeWidth="14" strokeLinecap="round" opacity="0.09"/>
                <path d="M455 80 C452 110,468 170,465 200" fill="none" stroke="#4facfe" strokeWidth="5" strokeLinecap="round" opacity="0.45" className="omni-route-wave omni-route-wave--vert"/>
                <path d="M465 80 C468 110,452 170,455 200" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" className="omni-route-wave"/>
                <path d="M460 80 C460 110,460 170,460 200" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* Local → Approvals */}
              <g filter="url(#rf-glow)" opacity="0.85" className="omni-route-wave-group">
                <path d="M480 80 C530 80,570 140,620 140" fill="none" stroke={statePalette[safeguardState]} strokeWidth="16" strokeLinecap="round" opacity="0.10"/>
                <path d="M480 80 C530 78,575 146,620 140" fill="none" stroke={statePalette[safeguardState]} strokeWidth="7" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--b"/>
                <path d="M480 80 C530 82,570 134,620 140" fill="none" stroke={statePalette[safeguardState]} strokeWidth="3.5" strokeLinecap="round" opacity="0.65" className="omni-route-wave"/>
                <path d="M480 80 C530 80,570 140,620 140" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* Cloud → Approvals */}
              <g filter="url(#rf-glow)" opacity="0.85" className="omni-route-wave-group">
                <path d="M480 200 C530 200,570 140,620 140" fill="none" stroke={statePalette[safeguardState]} strokeWidth="16" strokeLinecap="round" opacity="0.10"/>
                <path d="M480 200 C530 202,575 134,620 140" fill="none" stroke={statePalette[safeguardState]} strokeWidth="7" strokeLinecap="round" opacity="0.5" className="omni-route-wave"/>
                <path d="M480 200 C530 198,570 146,620 140" fill="none" stroke={statePalette[safeguardState]} strokeWidth="3.5" strokeLinecap="round" opacity="0.65" className="omni-route-wave omni-route-wave--b"/>
                <path d="M480 200 C530 200,570 140,620 140" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* Approvals → Output */}
              <g filter="url(#rf-glow)" opacity="0.85" className="omni-route-wave-group">
                <path d="M710 140 C760 140,800 140,840 140" fill="none" stroke={safeguardState === "good" ? statePalette.good : statePalette[safeguardState]} strokeWidth="16" strokeLinecap="round" opacity="0.10"/>
                <path d="M710 140 C760 132,805 148,840 140" fill="none" stroke={safeguardState === "good" ? statePalette.good : statePalette[safeguardState]} strokeWidth="7" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--b"/>
                <path d="M710 140 C760 148,800 132,840 140" fill="none" stroke={safeguardState === "good" ? "#c4b5fd" : statePalette[safeguardState]} strokeWidth="3.5" strokeLinecap="round" opacity="0.65" className="omni-route-wave"/>
                <path d="M710 140 C760 140,800 140,840 140" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" className="omni-route-wave omni-route-wave--c"/>
              </g>

              {/* ── NODES (glowing circles at each stage) ── */}
              <g className="omni-route-nodes">
                {/* Intake */}
                <circle cx="80" cy="140" r="8" fill="#a78bfa" opacity="0.15"/>
                <circle cx="80" cy="140" r="5" fill="#a78bfa"/>
                <circle cx="80" cy="140" r="2.5" fill="white"/>
                {/* OmniAI */}
                <circle cx="265" cy="140" r="10" fill="#a78bfa" opacity="0.15"/>
                <circle cx="265" cy="140" r="6.5" fill="#a78bfa"/>
                <circle cx="265" cy="140" r="3" fill="white"/>
                {/* Local Providers */}
                <circle cx="460" cy="80" r="8" fill={statePalette[localState]} opacity="0.15"/>
                <circle cx="460" cy="80" r="5" fill={statePalette[localState]}/>
                <circle cx="460" cy="80" r="2.5" fill="white" opacity="0.8"/>
                {/* Cloud Providers */}
                <circle cx="460" cy="200" r="8" fill={statePalette[providerState]} opacity="0.15"/>
                <circle cx="460" cy="200" r="5" fill={statePalette[providerState]}/>
                <circle cx="460" cy="200" r="2.5" fill="white" opacity="0.8"/>
                {/* Approvals/Tools */}
                <circle cx="665" cy="140" r="8" fill={statePalette[safeguardState]} opacity="0.15"/>
                <circle cx="665" cy="140" r="5" fill={statePalette[safeguardState]}/>
                <circle cx="665" cy="140" r="2.5" fill="white" opacity="0.8"/>
                {/* Output */}
                <circle cx="850" cy="140" r="8" fill={safeguardState === "good" ? statePalette.good : "#6d6484"} opacity="0.15"/>
                <circle cx="850" cy="140" r="5" fill={safeguardState === "good" ? statePalette.good : "#6d6484"}/>
                <circle cx="850" cy="140" r="2.5" fill="white" opacity="0.8"/>
              </g>

              {/* ── LABELS ── */}
              <g className="omni-route-labels">
                <text x="80" y="118" textAnchor="middle">INTAKE</text>
                <text x="80" y="162" textAnchor="middle" className="omni-route-caption">
                  {command ? `${command.totals.conversations24h?.toLocaleString() ?? "Unavailable"} convos` : "–"}
                </text>

                <text x="265" y="118" textAnchor="middle">OMNIAI</text>
                <text x="265" y="162" textAnchor="middle" className="omni-route-caption">Core router</text>

                <text x="460" y="58" textAnchor="middle">LOCAL PROVIDERS</text>
                <text x="460" y="70" textAnchor="middle" className="omni-route-caption">
                  {ollamaResult?.reachable ? `${(ollamaResult.models ?? []).length} models` : "unreachable"}
                </text>

                <text x="460" y="222" textAnchor="middle">CLOUD PROVIDERS</text>
                <text x="460" y="234" textAnchor="middle" className="omni-route-caption">
                  {providerResult ? `${enabledProviders.length} enabled` : "reading…"}
                </text>

                <text x="665" y="118" textAnchor="middle">APPROVALS</text>
                <text x="665" y="162" textAnchor="middle" className="omni-route-caption">
                  {safeguardResult ? `${safeguardResult.pending} pending` : "–"}
                </text>

                <text x="850" y="118" textAnchor="middle">OUTPUT</text>
                <text x="850" y="162" textAnchor="middle" className="omni-route-caption">
                  {command ? `${command.totals.assets24h?.toLocaleString() ?? "Unavailable"} assets` : "–"}
                </text>
              </g>
            </svg>

            <footer className="omni-route-legend">
              <span><i style={{ background: statePalette[localState] }} /> Local AI ({localState === "good" ? "connected" : "disconnected"})</span>
              <span><i style={{ background: statePalette[providerState] }} /> Cloud providers</span>
              <span><i style={{ background: "#4facfe" }} /> Cross-connect</span>
              <span><i style={{ background: statePalette[safeguardState] }} /> Approvals gate</span>
            </footer>
          </section>

          <div className="omni-board-side">
            {/* ---- approval queue ---- */}
            <section className="omni-panel omni-queue">
              <DisplaySurface
                accent={statePalette[safeguardState]}
                state={queueError ? "bad" : checkingSafeguards ? "busy" : queue && queue.length > 0 ? "good" : "idle"}
                seed={22}
              />
              <header className="omni-panel-head">
                <div>
                  <p className="omni-label">
                    GOVERNANCE <span>/</span> QUEUE
                  </p>
                  <h3>Approval queue</h3>
                </div>
                <Link href="/approvals" className="omni-panel-link">
                  View all <span>↗</span>
                </Link>
              </header>

              {checkingSafeguards && queue === null && (
                <p className="omni-panel-empty">Reading the queue…</p>
              )}
              {!checkingSafeguards && queueError && (
                <p className="omni-panel-empty">{queueError}</p>
              )}
              {!checkingSafeguards && !queueError && queue && queue.length === 0 && (
                <p className="omni-panel-empty">Nothing is waiting on you.</p>
              )}
              {queue && queue.length > 0 && (
                <ul className="omni-queue-list">
                  {queue.map((item) => (
                    <li key={item.id}>
                      <span className="omni-queue-icon" aria-hidden="true">✦</span>
                      <span className="omni-queue-copy">
                        <strong title={item.action}>{item.action}</strong>
                        <small>{ago(item.created_at)}</small>
                      </span>
                      <span className="omni-queue-badge">Needs review</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ---- cost pulse ---- */}
            <section className="omni-panel omni-cost">
              <DisplaySurface
                accent="#c4b5fd"
                state={command ? "good" : "idle"}
                seed={23}
              />
              <header className="omni-panel-head">
                <div>
                  <p className="omni-label">
                    CREDITS <span>/</span> PULSE
                  </p>
                  <h3>Usage and credits</h3>
                </div>
                {command && <span className="omni-section-count"><i />24H</span>}
              </header>

              {!command && <p className="omni-panel-empty">{commandUnavailable ? "Dashboard data is unavailable. Check the account session and data service." : "Reading the last 24 hours…"}</p>}

              {command && (
                <>
                  <p className="omni-cost-value">
                    {command.totals.spentCredits24h === null
                      ? "—"
                      : command.totals.spentCredits24h.toLocaleString()}
                    <span>credits spent · rolling 24 hours</span>
                  </p>

                  <div className="omni-cost-bars" aria-hidden="true">
                    <DisplaySurface variant="well" accent="#c4b5fd" state="idle" seed={31} />
                    {command.hourly?.map((count, index) => (
                      <span
                        key={index}
                        className="omni-cost-bar"
                        style={{ height: `${Math.max(4, Math.round((count / peakHourly) * 100))}%` }}
                        title={`${count} asset${count === 1 ? "" : "s"}`} aria-label={`${count} asset uploads`}
                      />
                    ))}
                  </div>
                  {!command.hourly && <p className="omni-cost-sub">Hourly asset activity is unavailable because the source returned an incomplete window.</p>}
                  <p className="omni-cost-sub">Asset uploads per hour</p>
                  {command.hourly && <p className="omni-cost-axis">
                    <span>24h ago</span>
                    <span>now</span>
                  </p>}

                  <p className="omni-cost-sub">
                    {command.totals.balance === null
                      ? command.available.billing
                        ? "Balance not reported yet."
                        : "Billing migration pending — balances arrive with the ledger."
                      : `Balance ${command.totals.balance.toLocaleString()} credits`}
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      </section>

      {/* ---- system health + alerts ---- */}
      <section className="omni-section">
        <div className="omni-section-heading">
          <div>
            <p className="omni-label">
              SYSTEMS <span>/</span> MONITORING
            </p>
            <h2>System health &amp; alerts</h2>
            <p>
              Live checks for every register. Each row opens its own page and
              carries its own recheck key.
            </p>
          </div>

          <span className="omni-section-count">
            <i />
            {String(environmentAreas.length).padStart(2, "0")} SYSTEM AREAS
          </span>
        </div>

        <div className="omni-bottom">
          <section className="omni-panel omni-health">
            <DisplaySurface
              accent={healthColor}
              state={isBusy ? "busy" : passingChecks === 4 ? "good" : passingChecks === 0 ? "bad" : "idle"}
              seed={24}
            />
            <header className="omni-panel-head">
              <div>
                <p className="omni-label">
                  AGENT <span>/</span> HEALTH
                </p>
                <h3>System health</h3>
              </div>
              <span className={`omni-section-count ${isBusy ? "busy" : ""}`}>
                <i />
                {passingChecks}/4 ANSWERING
              </span>
            </header>

            <ul className="omni-health-list">
              {healthRows.map((row) => (
                <li key={row.key} className={`omni-wave-${row.state}`}>
                  <Link href={row.href} className="omni-health-row">
                    <span
                      className="omni-health-icon"
                      style={{
                        color: statePalette[row.state],
                        borderColor: `${statePalette[row.state]}45`,
                      }}
                      aria-hidden="true"
                    >
                      {row.icon}
                    </span>
                    <span className="omni-health-copy">
                      <strong>{row.name}</strong>
                      <small>{row.detail}</small>
                    </span>
                    <span className={`omni-health-status ${row.state}`}>
                      <i />
                      {row.status}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="omni-health-check"
                    onClick={row.check}
                    disabled={row.busy}
                    aria-label={`Recheck ${row.name}`}
                  >
                    ⟳
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="omni-panel omni-alerts">
            <DisplaySurface
              accent={alerts.some((a) => a.tone === "critical") ? "#ff5c7a" : alerts.length > 0 ? "#ffb84d" : "#6ee7b7"}
              state={alerts.some((a) => a.tone === "critical") ? "bad" : alerts.length > 0 ? "busy" : "good"}
              seed={25}
            />
            <header className="omni-panel-head">
              <div>
                <p className="omni-label">
                  SYSTEM <span>/</span> ALERTS
                </p>
                <h3>System alerts</h3>
              </div>
              <span className="omni-section-count">
                <i />
                {visibleAlerts.length === 0 ? "ALL CLEAR" : `${visibleAlerts.length} OPEN`}
              </span>
            </header>

            {visibleAlerts.length === 0 ? (
              <p className="omni-panel-empty">
                No alerts in the last 24 hours — everything answered.
              </p>
            ) : (
              <ul className="omni-alert-list">
                {visibleAlerts.map((alert) => (
                  <li key={alert.key}>
                    <span className={`omni-alert-dot ${alert.tone}`} aria-hidden="true" />
                    <span className="omni-alert-copy">
                      <strong>{alert.title}</strong>
                      <small>{alert.sub}</small>
                    </span>
                    <Link href={alert.to} className="omni-panel-link">
                      Review <span>↗</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {alerts.length > visibleAlerts.length && (
              <footer className="omni-panel-foot">
                <Link href="/audit-log" className="omni-panel-link">
                  View all alerts <span>↗</span>
                </Link>
              </footer>
            )}
          </section>
        </div>
      </section>

      {/* ---- shortcuts / quick access ---- */}
      <section className="omni-section">
        <div className="omni-section-heading">
          <div>
            <p className="omni-label">
              OPERATIONS <span>/</span> QUICK ACCESS
            </p>
            <h2>Ready when you are.</h2>
          </div>
        </div>

        <div className="omni-shortcut-grid">
          {shortcuts.map((item) => {
            const isLoading = loadingShortcut === item.href;
            return (
              <a
                href={item.href}
                onClick={(e) => handleShortcutClick(e, item.href)}
                className={`omni-shortcut ${isLoading ? "is-loading" : ""}`}
                key={item.title}
              >
                <span className="omni-shortcut-code">
                  {isLoading ? (
                    <span className="omni-shortcut-spinner">⟳</span>
                  ) : (
                    item.code
                  )}
                </span>
                <span className="omni-shortcut-copy">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  <b>
                    {isLoading ? "Connecting..." : item.label}
                    {isLoading ? (
                      <span className="omni-shortcut-pulse" />
                    ) : (
                      <span>↗</span>
                    )}
                  </b>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <footer className="omni-safety">
        <span className="omni-safety-icon" aria-hidden="true">◇</span>
        <div>
          <strong>Safety by design</strong>
          <p>
            Website drafts remain subject to existing approval safeguards.
            Database status reflects database requests, Ollama status checks
            the local service, and provider indicators reflect settings only.
            No provider API calls are made just to test connectivity.
          </p>
        </div>
      </footer>

      <style jsx global>{`
        /* =====================================================
           OMNIAI COMMAND DECK
           A moulded control surface: milled panels sit still on
           the deck, and only the things you can press travel.
           ===================================================== */
        .omni-dashboard {
          --purple: #a78bfa;
          --pink: #e879f9;
          --cyan: #00f2fe;
          --good: #6ee7b7;
          --bad: #fb7185;
          --busy: #00f2fe;
          --idle: #b9a0ff;
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 0 0 32px;
          color: #eee9fb;
          display: flex;
          flex-direction: column;
          gap: clamp(22px, 3vw, 34px);
        }

        .omni-dashboard * {
          box-sizing: border-box;
        }

        /* ---- greeting sits above the hero panel ---- */
        .omni-welcome {
          padding: 4px 2px 0;
        }

        .omni-welcome__name {
          margin: 0;
          color: #f4f1ff;
          font-size: clamp(22px, 2.6vw, 30px);
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.03em;
          text-shadow: 0 0 26px rgba(108, 99, 255, 0.35);
        }

        .omni-welcome__sub {
          margin: 6px 0 0;
          color: #8f86ab;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        /* ---- hero panel: bolted to the deck ---- */
        .omni-dashboard .omni-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: clamp(20px, 3vw, 36px);
          border: 1px solid rgba(167, 139, 250, 0.38);
          border-radius: 23px;
          background:
            repeating-linear-gradient(112deg, rgba(255, 255, 255, 0.014) 0 1px, transparent 1px 3px),
            repeating-linear-gradient(68deg, rgba(0, 0, 0, 0.1) 0 1px, transparent 1px 4px),
            radial-gradient(ellipse at 72% 44%, rgba(126, 70, 220, 0.18), transparent 43%),
            radial-gradient(ellipse at 18% 0%, rgba(217, 70, 239, 0.09), transparent 38%),
            linear-gradient(135deg, #151020 0%, #090711 58%, #10091b 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.11),
            inset 1px 0 0 rgba(255, 255, 255, 0.035),
            inset -1px 0 0 rgba(0, 0, 0, 0.5),
            inset 0 -2px 4px rgba(0, 0, 0, 0.5),
            inset 0 0 70px rgba(108, 99, 255, 0.065),
            0 1px 0 rgba(0, 0, 0, 0.85),
            0 2px 0 rgba(255, 255, 255, 0.045),
            0 22px 65px rgba(0, 0, 0, 0.3),
            0 0 36px rgba(108, 99, 255, 0.075);
        }

        /* Corner rivets — the hero panel is bolted down, never leaning. */
        .omni-dashboard .omni-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 15px 15px, rgba(255, 255, 255, 0.2) 0 1.6px, rgba(0, 0, 0, 0.55) 1.6px 3.2px, transparent 3.6px),
            radial-gradient(circle at calc(100% - 15px) 15px, rgba(255, 255, 255, 0.2) 0 1.6px, rgba(0, 0, 0, 0.55) 1.6px 3.2px, transparent 3.6px),
            radial-gradient(circle at 15px calc(100% - 15px), rgba(255, 255, 255, 0.2) 0 1.6px, rgba(0, 0, 0, 0.55) 1.6px 3.2px, transparent 3.6px),
            radial-gradient(circle at calc(100% - 15px) calc(100% - 15px), rgba(255, 255, 255, 0.2) 0 1.6px, rgba(0, 0, 0, 0.55) 1.6px 3.2px, transparent 3.6px),
            repeating-linear-gradient(0deg, transparent 0, transparent 4px, rgba(196, 181, 253, 0.018) 5px),
            linear-gradient(115deg, transparent 20%, rgba(167, 139, 250, 0.045) 48%, rgba(103, 232, 249, 0.025) 54%, transparent 78%);
          opacity: 0.85;
        }

        .omni-dashboard .omni-hero > *:not(.omni-orb) {
          position: relative;
          z-index: 1;
        }

        .omni-orb {
          position: absolute;
          z-index: -1;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(75px);
        }

        .orb-a {
          width: 220px;
          height: 220px;
          right: 15%;
          top: -150px;
          background: #854af42b;
        }

        .orb-b {
          width: 190px;
          height: 190px;
          left: 20%;
          bottom: -165px;
          background: #d54ce51a;
        }

        .omni-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
          gap: clamp(18px, 2.4vw, 30px);
          margin-top: 25px;
        }

        /* The command deck leads: the core takes the full hero measure and the
           operator strip (label, actions, live note) sits under it. */
        .omni-hero-grid .omni-intro {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px clamp(18px, 3vw, 34px);
        }

        .omni-hero-grid .omni-intro .omni-label {
          margin-right: auto;
        }

        .omni-intro {
          min-width: 0;
        }

        .omni-label {
          color: #a993e9;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.16em;
          line-height: 1.5;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.75);
        }

        .omni-label span {
          color: #68538f;
          padding: 0 4px;
        }

        .omni-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 0;
        }

        /* ---- keys: moulded caps that travel down into the deck.
               Blocks never move; the things you can press do — a
               barely-there press on hover, a real travel on click. ---- */
        .omni-button,
        .omni-kpi-link,
        .omni-health-check {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid rgba(0, 0, 0, 0.75);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
          text-decoration: none;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.3),
            inset 0 -3px 6px rgba(0, 0, 0, 0.5),
            0 5px 0 -1px #07050e,
            0 7px 0 rgba(167, 139, 250, 0.1),
            0 16px 24px rgba(0, 0, 0, 0.5);
          transition:
            transform 140ms ease,
            box-shadow 140ms ease,
            border-color 160ms ease,
            background 160ms ease;
        }

        /* Hover presses the key in — barely, just a hair of travel. */
        .omni-button:hover,
        .omni-kpi-link:hover,
        .omni-health-check:hover:not(:disabled) {
          transform: translateY(1px);
          box-shadow:
            inset 0 2px 4px rgba(0, 0, 0, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.12),
            0 2px 0 -1px #07050e,
            0 4px 10px rgba(0, 0, 0, 0.45);
        }

        .omni-button:active:not(:disabled),
        .omni-kpi-link:active,
        .omni-health-check:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.75),
            inset 0 -1px 0 rgba(255, 255, 255, 0.12),
            0 1px 0 #07050e,
            0 3px 10px rgba(0, 0, 0, 0.55);
        }

        .omni-button.primary {
          color: white;
          background: linear-gradient(115deg, #7548e8, #8b5cf6);
          border-color: #c1aaff6b;
        }

        .omni-button.primary > span {
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          border-radius: 7px;
          background: #ffffff24;
          font-size: 9px;
        }

        .omni-button.quiet {
          color: #d7ccef;
          background: #0f0c19b8;
          border-color: #4b3b67;
        }

        .omni-button.quiet:hover {
          border-color: #a78bfa;
          background: rgba(139, 92, 246, 0.09);
        }

        .omni-live-note {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 0;
          color: #9487ad;
          font-size: 9px;
          letter-spacing: 0.07em;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow: 0 0 8px #a78bfa88;
        }

        .live-dot.busy {
          background: var(--cyan);
          box-shadow: 0 0 10px var(--cyan);
          animation: omni-pulse 0.8s infinite;
        }

        /* ---- the core floats free: no card, no bezel ---- */
        .omni-dashboard .omni-core {
          position: relative;
          min-width: 0;
          background: none;
          border: none;
          border-radius: 0;
          box-shadow: none;
          animation: none;
        }

        /* The screen sits darker than the deck so the orb lights its own
           room; the WebGL halo behind it supplies the moving reflection. */
        .omni-core-canvas {
          position: relative;
          height: clamp(340px, 46vw, 620px);
          overflow: hidden;
          border: none;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          /* The block keeps its size — just a little darker than the deck it
             sits on. The core's reflection bounces across it from the WebGL
             scene (alpha canvas), so no bezel, no screen chrome. */
          background: radial-gradient(
            ellipse at 50% 46%,
            rgba(8, 5, 17, 0.52),
            rgba(5, 4, 11, 0.62) 62%,
            rgba(4, 3, 9, 0.68) 100%
          );
          box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.42);
        }

        .omni-dashboard-holo-orb {
          margin: auto;
          position: relative;
          z-index: 1;
        }

        .omni-core-canvas canvas {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          z-index: 0;
          filter: saturate(1.18) contrast(1.04);
        }

        /* Title rides inside the graphic, upper-left, like the reference deck. */
        .omni-core-canvas-head {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          pointer-events: none;
        }

        .omni-core-canvas-title {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          color: #f0eaff;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
          text-shadow: 0 0 18px rgba(108, 99, 255, 0.45);
        }

        .omni-core-canvas-title i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow: 0 0 10px #a78bfa;
        }

        .omni-core-tally {
          margin: 0;
          padding: 11px 16px 2px;
          text-align: center;
          color: #87799f;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .omni-core-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 16px 13px;
          color: #87799f;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .omni-core-legend {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 11px;
          min-width: 0;
        }

        .omni-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          letter-spacing: 0.05em;
          transition: opacity 0.3s ease;
        }

        .omni-legend-item i {
          width: 5px;
          height: 5px;
          flex-shrink: 0;
          border-radius: 50%;
        }

        .omni-core-mode {
          flex-shrink: 0;
          margin-left: auto;
          padding-left: 10px;
          white-space: nowrap;
          color: #6d6389;
        }

        /* ---- sections ---- */
        .omni-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* A groove milled between sections. */
        .omni-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.75);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .omni-section-heading h2 {
          margin-top: 7px;
          color: #f0ebff;
          font-size: clamp(1.45rem, 2.4vw, 1.9rem);
          font-weight: 750;
          letter-spacing: -0.035em;
          text-wrap: balance;
          text-shadow:
            0 1px 0 rgba(0, 0, 0, 0.85),
            0 0 34px rgba(167, 139, 250, 0.16);
        }

        .omni-section-heading p:not(.omni-label) {
          margin-top: 6px;
          color: #958ba9;
          font-size: 11px;
          line-height: 1.7;
        }

        /* Status badges read as lit metal tags. */
        .omni-section-count {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(0, 0, 0, 0.65);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(31, 25, 49, 0.96), rgba(14, 11, 24, 0.96));
          padding: 9px 11px;
          color: #a49ab9;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.75);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            inset 0 -2px 4px rgba(0, 0, 0, 0.55),
            0 2px 0 -1px rgba(255, 255, 255, 0.05),
            0 8px 16px rgba(0, 0, 0, 0.45);
        }

        .omni-section-count i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow: 0 0 8px #a78bfa80;
        }

        .omni-section-count.busy i {
          background: #00f2fe;
          box-shadow: 0 0 12px #00f2fe;
          animation: omni-pulse 0.8s infinite;
        }

        /* ---- moulded panel material ---- */
        .omni-panel,
        .omni-kpi {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-width: 0;
          border: 1px solid rgba(167, 139, 250, 0.19);
          border-radius: 18px;
          background:
            repeating-linear-gradient(112deg, rgba(255, 255, 255, 0.016) 0 1px, transparent 1px 3px),
            radial-gradient(ellipse at 100% 0%, rgba(124, 58, 237, 0.09), transparent 46%),
            linear-gradient(150deg, rgba(23, 18, 34, 0.97), rgba(10, 9, 16, 0.98) 72%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.11),
            inset 1px 0 0 rgba(255, 255, 255, 0.035),
            inset -1px 0 0 rgba(0, 0, 0, 0.5),
            inset 0 -2px 4px rgba(0, 0, 0, 0.5),
            inset 0 0 46px rgba(96, 62, 190, 0.08),
            0 1px 0 rgba(0, 0, 0, 0.85),
            0 2px 0 rgba(255, 255, 255, 0.045),
            0 16px 34px rgba(0, 0, 0, 0.42);
          /* Panels are stationary: no lift, no lean, no tilt. */
          transition: border-color 200ms ease;
        }

        /* The WebGL face of every display: a full-quad fragment shader paints
           the material (grain, weave, sheen, state glow) behind the content. */
        .omni-display {
          position: absolute;
          inset: 0;
          z-index: 0;
          display: block;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          pointer-events: none;
        }

        /* Content rides above the canvas; the shader paints the machined
           top-edge glint itself. */
        .omni-panel > :not(.omni-display),
        .omni-kpi > :not(.omni-display) {
          position: relative;
          z-index: 1;
        }

        .omni-cost-bars > :not(.omni-display),
        .omni-kpi-value > :not(.omni-display) {
          position: relative;
          z-index: 1;
        }

        .omni-panel:hover,
        .omni-kpi:hover {
          border-color: rgba(167, 139, 250, 0.32);
        }

        .omni-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 17px;
        }

        .omni-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.62);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .omni-panel-head h3 {
          margin-top: 5px;
          color: #f0ebff;
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .omni-panel-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          color: #bba6ff;
          font-size: 10px;
          font-weight: 800;
          text-decoration: none;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.7);
          transition: color 160ms ease;
        }

        .omni-panel-link span {
          transition: transform 160ms ease;
        }

        .omni-panel-link:hover {
          color: #f0eaff;
        }

        .omni-panel-link:hover span {
          transform: translate(2px, -2px);
        }

        .omni-panel-empty {
          margin: 0;
          padding: 8px 2px;
          color: #958ba9;
          font-size: 11px;
          line-height: 1.7;
        }

        .omni-panel-foot {
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.5);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        /* ---- KPI tiles: equal by construction ---- */
        .omni-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .omni-kpi {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px;
        }

        .omni-kpi-head {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .omni-kpi-icon {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 1px solid rgba(0, 0, 0, 0.65);
          border-radius: 9px;
          background: linear-gradient(160deg, rgba(84, 60, 136, 0.92), rgba(24, 18, 42, 0.96));
          font-size: 15px;
          text-shadow: 0 0 12px currentColor;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            inset 0 -3px 5px rgba(0, 0, 0, 0.55),
            0 3px 0 -1px rgba(0, 0, 0, 0.85),
            0 10px 16px rgba(0, 0, 0, 0.45);
        }

        /* The value sits in a sunk LED window, same height on every tile. */
        .omni-kpi-value {
          display: flex;
          align-items: center;
          min-height: 52px;
          border: 1px solid rgba(0, 0, 0, 0.75);
          border-radius: 10px;
          padding: 8px 12px;
          background: linear-gradient(180deg, #0b0913, #110e1e);
          color: #f1eaff;
          font-size: clamp(1.35rem, 2.4vw, 1.8rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          text-shadow:
            0 1px 0 rgba(0, 0, 0, 0.9),
            0 0 16px rgba(167, 139, 250, 0.3);
          box-shadow:
            inset 0 3px 8px rgba(0, 0, 0, 0.85),
            inset 0 -1px 0 rgba(255, 255, 255, 0.06),
            0 1px 0 rgba(255, 255, 255, 0.07);
        }

        .omni-kpi-note {
          min-height: 32px;
          color: rgba(203, 195, 222, 0.72);
          font-size: 10px;
          line-height: 1.55;
          overflow-wrap: anywhere;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
        }

        .omni-kpi-foot {
          margin-top: auto;
          display: flex;
        }

        .omni-kpi-link {
          min-height: 35px;
          padding: 8px 11px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 750;
          color: #c7b6ed;
          background: #6949a81a;
        }

        /* ---- board: routing map + side column ---- */
        .omni-board {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
          gap: 15px;
          align-items: stretch;
        }

        .omni-board-side {
          display: flex;
          flex-direction: column;
          gap: 15px;
          min-width: 0;
        }

        /* ── Mesh wavelength routing diagram ── */
        .omni-route-svg {
          width: 100%;
          height: auto;
          font-family: inherit;
          /* Recessed plate effect behind the SVG */
          border-radius: 12px;
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 48px),
            repeating-linear-gradient(0deg,  rgba(255,255,255,0.012) 0 1px, transparent 1px 48px),
            radial-gradient(ellipse at 50% 50%, rgba(108,99,255,0.06), transparent 70%),
            linear-gradient(180deg, #060410, #0c0818);
          box-shadow:
            inset 0 3px 12px rgba(0,0,0,0.9),
            inset 0 0 40px rgba(108,99,255,0.04),
            inset 0 -1px 0 rgba(255,255,255,0.04),
            0 1px 0 rgba(255,255,255,0.07);
          overflow: visible;
        }

        /* Animated mesh wave strands */
        .omni-route-wave {
          stroke-dasharray: 14 6;
          animation: omni-mesh-wave 2.2s linear infinite;
        }
        .omni-route-wave--b {
          stroke-dasharray: 10 8;
          animation: omni-mesh-wave 3.1s linear infinite reverse;
        }
        .omni-route-wave--c {
          stroke-dasharray: 6 10;
          animation: omni-mesh-wave 4.0s linear infinite;
          opacity: 0.35 !important;
        }
        .omni-route-wave--vert {
          stroke-dasharray: 12 7;
          animation: omni-mesh-wave-vert 2.8s linear infinite;
        }
        @keyframes omni-mesh-wave {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -80; }
        }
        @keyframes omni-mesh-wave-vert {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -60; }
        }

        .omni-route-nodes circle {
          filter: drop-shadow(0 0 5px currentColor);
        }
        .omni-route-wave-group {
          transition: opacity 600ms ease;
        }

        .omni-route-labels text {
          fill: #d9d0f2;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .omni-route-labels .omni-route-caption {
          fill: #7a7294;
          font-size: 9px;
          font-weight: 500;
        }

        .omni-route-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          padding-top: 11px;
          border-top: 1px solid rgba(0,0,0,0.55);
          box-shadow: 0 1px 0 rgba(255,255,255,0.04);
          color: #87799f;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .omni-route-legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .omni-route-legend i {
          width: 14px;
          height: 3px;
          border-radius: 2px;
          box-shadow: 0 0 6px currentColor;
        }

        /* ---- approval queue ---- */
        .omni-queue-list,
        .omni-alert-list,
        .omni-health-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .omni-queue-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(0, 0, 0, 0.6);
          border-radius: 9px;
          padding: 9px 10px;
          background: linear-gradient(180deg, #0c0a15, #12101d);
          box-shadow:
            inset 0 2px 4px rgba(0, 0, 0, 0.7),
            inset 0 -1px 0 rgba(255, 255, 255, 0.06),
            0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .omni-queue-icon {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          flex-shrink: 0;
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 7px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 11px;
          text-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
        }

        .omni-queue-copy {
          display: block;
          min-width: 0;
          flex: 1;
        }

        .omni-queue-copy strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #e6def8;
          font-size: 11px;
          font-weight: 700;
        }

        .omni-queue-copy small {
          display: block;
          margin-top: 3px;
          color: #87799f;
          font-size: 9px;
        }

        .omni-queue-badge {
          flex-shrink: 0;
          border: 1px solid rgba(167, 139, 250, 0.28);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.09);
          padding: 4px 8px;
          color: #c4b5fd;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        /* ---- cost pulse ---- */
        .omni-cost-value {
          display: flex;
          align-items: baseline;
          gap: 9px;
          margin: 0;
          color: #f1eaff;
          font-size: clamp(1.4rem, 2.6vw, 1.9rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          text-shadow:
            0 1px 0 rgba(0, 0, 0, 0.9),
            0 0 18px rgba(167, 139, 250, 0.28);
        }

        .omni-cost-value span {
          color: #958ba9;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .omni-cost-bars {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 62px;
          border: 1px solid rgba(0, 0, 0, 0.62);
          border-radius: 10px;
          padding: 9px 9px 0;
          background: linear-gradient(180deg, #0a0812, #100d1b);
          box-shadow:
            inset 0 3px 9px rgba(0, 0, 0, 0.85),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05);
        }

        .omni-cost-bar {
          flex: 1;
          min-height: 2px;
          border-radius: 2px;
          background: linear-gradient(180deg, #c3b4ff, #7b6dff 55%, #4b3fd4);
          opacity: 0.85;
          box-shadow:
            0 0 8px rgba(108, 99, 255, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.45);
          transition: height 400ms ease;
        }

        .omni-cost-axis {
          display: flex;
          justify-content: space-between;
          margin: 0;
          color: #6d6484;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .omni-cost-sub {
          margin: 0;
          color: #958ba9;
          font-size: 10px;
          line-height: 1.7;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
        }

        /* ── System health 3D gauge plate ── */
        .omni-bottom {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 15px;
          align-items: stretch;
        }

        /* The health panel gets a recessed gauge plate treatment */
        .omni-health {
          position: relative;
        }

        .omni-health-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          /* 3D recessed inset container */
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.008) 0 1px, transparent 1px 96px),
            linear-gradient(180deg, #04030a, #08061200);
          border: 1px solid rgba(0,0,0,0.8);
          border-radius: 12px;
          padding: 10px;
          box-shadow:
            inset 0 4px 16px rgba(0,0,0,0.95),
            inset 0 1px 0 rgba(255,255,255,0.03),
            inset 0 -1px 0 rgba(255,255,255,0.025),
            0 1px 0 rgba(255,255,255,0.06);
        }

        .omni-health-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          /* Each row is slightly raised above the recessed plate */
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(20,15,35,0.9), rgba(10,8,20,0.95));
          border: 1px solid rgba(255,255,255,0.04);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 2px 6px rgba(0,0,0,0.6);
          padding: 2px 4px 2px 2px;
        }

        .omni-health-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
          border: none;
          border-radius: 6px;
          padding: 7px 8px;
          background: transparent;
          color: inherit;
          text-decoration: none;
          transition: background 160ms ease;
        }

        .omni-health-row:hover {
          background: rgba(139,92,246,0.06);
        }

        .omni-health-icon {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border: 1px solid;
          border-radius: 7px;
          background: rgba(139,92,246,0.07);
          font-size: 13px;
          text-shadow: 0 0 10px currentColor;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -2px 4px rgba(0,0,0,0.5);
        }

        .omni-health-copy {
          display: block;
          min-width: 0;
          flex: 1;
        }

        .omni-health-copy strong {
          display: block;
          color: #e6def8;
          font-size: 11px;
          font-weight: 750;
        }

        .omni-health-copy small {
          display: block;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #87799f;
          font-size: 9px;
        }

        /* Live canvas chart replaces the static SVG sparkline */
        .omni-health-row canvas {
          flex-shrink: 0;
          border-radius: 6px;
          /* Recessed gauge window around the chart */
          border: 1px solid rgba(0,0,0,0.75);
          box-shadow:
            inset 0 2px 6px rgba(0,0,0,0.85),
            inset 0 -1px 0 rgba(255,255,255,0.04),
            0 0 8px rgba(108,99,255,0.08);
          background: linear-gradient(180deg, #04030b, #080614);
        }

        /* keep old spark class functional (not needed but harmless) */
        .omni-spark { display: none; }

        .omni-health-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          border: 1px solid rgba(0, 0, 0, 0.68);
          border-radius: 999px;
          background: linear-gradient(180deg, #0a0812, #12101c);
          padding: 5px 9px;
          color: #b7adc9;
          font-size: 9px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow:
            inset 0 2px 5px rgba(0, 0, 0, 0.75),
            inset 0 -1px 0 rgba(255, 255, 255, 0.07),
            0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .omni-health-status i {
          width: 5px;
          height: 5px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #9b8bb4;
        }

        .omni-health-status.good i {
          background: #6ee7b7;
          box-shadow: 0 0 7px #6ee7b766;
        }

        .omni-health-status.bad i {
          background: #fb7185;
          box-shadow: 0 0 7px #fb718566;
        }

        .omni-health-status.busy i {
          background: #00f2fe;
          box-shadow: 0 0 8px #00f2fe;
          animation: omni-pulse 0.8s infinite;
        }

        .omni-health-check {
          min-height: 0;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          padding: 0;
          border-radius: 9px;
          color: #c7b6ed;
          background: #6949a81a;
          font-size: 15px;
        }

        /* ---- system alerts ---- */
        .omni-alert-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(0, 0, 0, 0.55);
          border-radius: 10px;
          padding: 9px 10px;
          background: linear-gradient(180deg, #0c0a15, #12101d);
          box-shadow:
            inset 0 2px 4px rgba(0, 0, 0, 0.7),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05);
        }

        .omni-alert-dot {
          width: 6px;
          height: 6px;
          flex-shrink: 0;
          border-radius: 50%;
        }

        .omni-alert-dot.critical {
          background: #ff2a6d;
          box-shadow: 0 0 8px #ff2a6d80;
        }

        .omni-alert-dot.warning {
          background: #ffb84d;
          box-shadow: 0 0 8px #ffb84d70;
        }

        .omni-alert-dot.note {
          background: #9490ac;
        }

        .omni-alert-copy {
          display: block;
          min-width: 0;
          flex: 1;
        }

        .omni-alert-copy strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #e6def8;
          font-size: 11px;
          font-weight: 700;
        }

        .omni-alert-copy small {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #87799f;
          font-size: 9.5px;
        }

        /* ---- shortcuts / quick access ---- */
        .omni-shortcut-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .omni-shortcut {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          gap: 12px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 14px;
          padding: 16px;
          background: linear-gradient(
            145deg,
            rgba(20, 15, 32, 0.92),
            rgba(10, 8, 17, 0.96)
          );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          user-select: none;
          transition:
            transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 200ms ease,
            box-shadow 200ms ease,
            background 200ms ease;
          will-change: transform, border-color, box-shadow;
        }

        .omni-shortcut:hover {
          transform: translateY(-2px) scale(1.05);
          border-color: #00ffff;
          background: linear-gradient(
            145deg,
            rgba(28, 20, 48, 0.96),
            rgba(12, 10, 22, 0.98)
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 12px 32px rgba(0, 0, 0, 0.35),
            0 0 16px rgba(0, 255, 255, 0.45),
            0 0 32px rgba(0, 242, 254, 0.25);
        }

        .omni-shortcut:active {
          transform: translateY(0px) scale(0.95);
          border-color: #00ffff;
          box-shadow:
            inset 0 3px 8px rgba(0, 0, 0, 0.6),
            0 2px 6px rgba(0, 0, 0, 0.3),
            0 0 14px rgba(0, 255, 255, 0.4);
          transition-duration: 75ms;
        }

        .omni-shortcut.is-loading {
          border-color: #00ffff !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 0 24px rgba(0, 255, 255, 0.5),
            inset 0 0 12px rgba(0, 255, 255, 0.2) !important;
          pointer-events: none;
        }

        .omni-shortcut-spinner {
          display: inline-block;
          animation: omni-spin 0.8s linear infinite;
          color: #00ffff;
          font-size: 15px;
        }

        .omni-shortcut-pulse {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00ffff;
          margin-left: 6px;
          box-shadow: 0 0 8px #00ffff;
          animation: omni-pulse 0.8s ease-in-out infinite alternate;
        }

        @keyframes omni-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .omni-shortcut-code {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 10px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          background: rgba(139, 92, 246, 0.12);
          color: #c4b5fd;
          font-family: var(--dms-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          transition: border-color 200ms ease, background 200ms ease, color 200ms ease;
        }

        .omni-shortcut:hover .omni-shortcut-code {
          border-color: rgba(0, 242, 254, 0.5);
          background: rgba(0, 242, 254, 0.15);
          color: #00f2fe;
        }

        .omni-shortcut-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .omni-shortcut-copy strong {
          color: #f1f0f7;
          font-size: 13px;
          font-weight: 600;
        }

        .omni-shortcut-copy small {
          color: #8d87a8;
          font-size: 11px;
          line-height: 1.4;
        }

        .omni-shortcut-copy b {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 11px;
          color: #a78bfa;
          font-weight: 600;
          transition: color 200ms ease, transform 200ms ease;
        }

        .omni-shortcut:hover .omni-shortcut-copy b {
          color: #00f2fe;
          transform: translateX(2px);
        }

        /* ---- safety footer ---- */
        .omni-safety {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          overflow: hidden;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 16px;
          padding: 16px;
          background:
            repeating-linear-gradient(112deg, rgba(255, 255, 255, 0.014) 0 1px, transparent 1px 3px),
            linear-gradient(115deg, rgba(30, 21, 44, 0.8), rgba(11, 9, 17, 0.9));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.11),
            inset 0 -2px 4px rgba(0, 0, 0, 0.5),
            0 1px 0 rgba(0, 0, 0, 0.85),
            0 12px 28px rgba(0, 0, 0, 0.35);
        }

        .omni-safety-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border: 1px solid #9f7ce245;
          border-radius: 9px;
          background: #7049e81f;
          color: #c4b5fd;
          font-size: 20px;
          text-shadow: 0 0 18px rgba(167, 139, 250, 0.24);
        }

        .omni-safety strong {
          color: #e6def8;
          font-size: 11px;
          font-weight: 800;
        }

        .omni-safety p {
          margin-top: 5px;
          color: #a39ab8;
          font-size: 10px;
          line-height: 1.8;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
        }

        .omni-dashboard button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .omni-dashboard a:focus-visible,
        .omni-dashboard button:focus-visible {
          outline: 2px solid #c4b5fd;
          outline-offset: 4px;
        }

        @keyframes omni-pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }

        @keyframes omni-wave-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -60; }
        }

        @keyframes omni-route-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -36; }
        }

        /* ---- responsive ---- */
        @media (max-width: 1180px) {
          .omni-board,
          .omni-bottom {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 900px) {
          .omni-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .omni-core-canvas {
            height: 300px;
          }
        }

        @media (max-width: 700px) {
          .omni-dashboard .omni-hero {
            padding: 18px;
            border-radius: 17px;
          }

          .omni-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .omni-health-copy small {
            display: none;
          }

          .omni-spark {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .omni-kpis {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        /* ---- reduced motion: the objects stay, the movement goes ---- */
        @media (prefers-reduced-motion: reduce) {
          .omni-route-ribbons path,
          .omni-spark.is-busy path,
          .omni-health-status.busy i,
          .omni-section-count.busy i,
          .live-dot.busy {
            animation: none !important;
          }

          .omni-button,
          .omni-kpi-link,
          .omni-health-check,
          .omni-cost-bar {
            transition: none !important;
          }

          .omni-button:hover,
          .omni-kpi-link:hover,
          .omni-health-check:hover:not(:disabled),
          .omni-button:active:not(:disabled),
          .omni-kpi-link:active,
          .omni-health-check:active:not(:disabled) {
            transform: none;
          }

          .omni-hero::before {
            opacity: 0.45;
          }
        }
      `}</style>
    </main>
  );
}
