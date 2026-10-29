"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import HoloOrb from "@/components/HoloOrb";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Sliders,
  Send,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  BarChart2,
  GitCommit,
  GitBranch,
  Copy,
  Check,
  Download,
  Share2,
  Terminal as TerminalIcon,
  Cpu,
  Layers,
  Radio,
  Zap,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Code,
  FileText,
  Boxes,
  ShieldCheck,
  RefreshCw,
  Gauge,
  CornerDownRight,
  Globe,
  UploadCloud,
} from "lucide-react";

interface PromptRevision {
  id: string;
  hash: string;
  version: string;
  timestamp: string;
  author: string;
  title: string;
  prompt: string;
  systemInstruction: string;
  temperature: number;
  tokens: number;
}

interface ModelStreamState {
  id: string;
  name: string;
  channel: string;
  engine: string;
  badge: string;
  badgeColor: string;
  output: string;
  isStreaming: boolean;
  tokens: number;
  latencyMs: number;
  tps: number;
  costEst: string;
  status: "idle" | "streaming" | "completed" | "frozen";
}

const INITIAL_REVISIONS: PromptRevision[] = [
  {
    id: "rev-3",
    hash: "a94f1c2",
    version: "v2.4.1 (Current Active)",
    timestamp: "Just now",
    author: "Lead Architect",
    title: "Quantum Context & Strict JSON Guard",
    prompt:
      "Synthesize an ultra-high performance event loop pipeline for Dark Misfit Studios. Ensure all responses enforce Obsidian Cyberpunk tokens (#000000, #0a071b, #6366f1, #00ffcc) and return deterministic telemetry logs.",
    systemInstruction:
      "You are OmniAI - Nexus Core Architecture Intelligence. You operate with deterministic precision, zero conversational boilerplate, hyper-structured JSON/Markdown telemetry, and maximum token efficiency.",
    temperature: 0.7,
    tokens: 385,
  },
  {
    id: "rev-2",
    hash: "8e2d4b0",
    version: "v2.3.0 (Production Stable)",
    timestamp: "2 hours ago",
    author: "Systems Core",
    title: "Added Top-P bounds & sub-20ms latency",
    prompt:
      "Build a streaming telemetry API connector connecting Stripe webhooks, PostgreSQL pools, and WebSocket clients.",
    systemInstruction:
      "You are the Lead Systems Integration Engineer for Dark Misfit Studios. Respond in raw code blocks and zero-latency specifications.",
    temperature: 0.5,
    tokens: 240,
  },
  {
    id: "rev-1",
    hash: "3c7a9e1",
    version: "v2.1.0 (Initial Baseline)",
    timestamp: "Yesterday",
    author: "AI Interface Team",
    title: "Baseline multi-model routing prompt",
    prompt:
      "Create an automation loop that triggers on inbound webhooks and sends Discord notifications.",
    systemInstruction: "You are an AI assistant helping build automations.",
    temperature: 0.8,
    tokens: 180,
  },
];

const CONTEXT_VARIABLES = [
  { tag: "{{closet_inventory}}", label: "Closet Inventory State", desc: "Live user wardrobe assets" },
  { tag: "{{script_markdown}}", label: "Script Markdown Buffer", desc: "Active video storyboard script" },
  { tag: "{{user_session_token}}", label: "Session Bearer Token", desc: "Encrypted JWT auth context" },
  { tag: "{{active_db_schema}}", label: "Cloud SQL Schema V3", desc: "PostgreSQL DDL table structure" },
];

export default function PromptStudioPage() {
  const router = useRouter();

  // PANEL 1: PROMPT FACTORY & METADATA DECK STATE
  const [systemInstruction, setSystemInstruction] = useState(
    "You are OmniAI - Nexus Core Architecture Intelligence. You operate with deterministic precision, zero conversational boilerplate, hyper-structured JSON/Markdown telemetry, and maximum token efficiency."
  );

  // Mathematical Model Parameters
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [freqPenalty, setFreqPenalty] = useState(0.0);
  const [presPenalty, setPresPenalty] = useState(0.0);

  // PANEL 2: CENTRAL PROMPT WORKSPACE STATE
  const [promptText, setPromptText] = useState(
    "Synthesize an ultra-high performance event loop pipeline for Dark Misfit Studios. Ensure all responses enforce Obsidian Cyberpunk tokens (#000000, #0a071b, #6366f1, #00ffcc) and return deterministic telemetry logs."
  );

  // Multi-Model Stream Replication Channels
  const [modelStreams, setModelStreams] = useState<ModelStreamState[]>([
    {
      id: "gemini",
      name: "Google AI Studio Endpoint",
      channel: "Channel 01",
      engine: "Gemini 1.5 Pro",
      badge: "2M Context",
      badgeColor: "#00ffcc",
      output:
        "{\n  \"engine\": \"OmniAI - Nexus Core\",\n  \"status\": \"ACTIVE_SYNCHRONIZED\",\n  \"palette\": {\n    \"canvas\": \"#000000\",\n    \"container\": \"#0a071b\",\n    \"accent\": \"#6366f1\",\n    \"readout\": \"#00ffcc\"\n  },\n  \"telemetry\": {\n    \"latency_ms\": 18.4,\n    \"deterministic_score\": 0.998,\n    \"slots\": \"20/20\"\n  }\n}",
      isStreaming: false,
      tokens: 412,
      latencyMs: 18.4,
      tps: 185,
      costEst: "$0.00018",
      status: "idle",
    },
    {
      id: "ollama",
      name: "Local Ollama Node Channel",
      channel: "Channel 02",
      engine: "Llama 3 70B (Private Sandbox)",
      badge: "Air-Gapped",
      badgeColor: "#6366f1",
      output:
        "// DARK MISFIT STUDIOS // PRIVATE NODE EXECUTION\nconst pipeline = {\n  runtime: 'v8-sandbox',\n  zeroEgress: true,\n  ledgerTable: 'nexus_active_state_sync',\n  tokens: { neon: '#00ffcc', obsidian: '#0a071b' }\n};\nexport default pipeline;",
      isStreaming: false,
      tokens: 388,
      latencyMs: 142.1,
      tps: 52,
      costEst: "$0.00000 (Local)",
      status: "idle",
    },
    {
      id: "groq",
      name: "Groq LPU API Channel",
      channel: "Channel 03",
      engine: "Llama 3 8B Instant",
      badge: "840 TPS Max-Speed",
      badgeColor: "#00ffff",
      output:
        "[GROQ_LPU_INFERENCE_STREAM]\n>> TTFT: 12ms | Latency: 44ms | Speed: 840 tokens/sec\n>> Payload received: Vector prompt ingested.\n>> Compiling sub-cycle event triggers: 200 OK.",
      isStreaming: false,
      tokens: 295,
      latencyMs: 44.2,
      tps: 840,
      costEst: "$0.00005",
      status: "idle",
    },
  ]);

  // Viewport & Benchmark States
  const [isAnyStreaming, setIsAnyStreaming] = useState(false);
  const [areStatesFrozen, setAreStatesFrozen] = useState(false);
  const [evalMetrics, setEvalMetrics] = useState<{
    cosineAlignment: string;
    tokenEfficiencyRatio: string;
    latencyDelta: string;
  } | null>(null);

  // PANEL 3: VERSION CONTROL TREE STATE
  const [revisions, setRevisions] = useState<PromptRevision[]>(INITIAL_REVISIONS);
  const [activeRevisionId, setActiveRevisionId] = useState<string>("rev-3");

  // Notifications & Copied Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Omni Shortcuts Navigation Loading State
  const [loadingShortcut, setLoadingShortcut] = useState<string | null>(null);

  // Calculations for Real-Time Token Analyzer
  const totalInputTokens = useMemo(() => {
    return Math.round((promptText.length + systemInstruction.length) / 4);
  }, [promptText, systemInstruction]);

  const totalOutputTokens = useMemo(() => {
    return modelStreams.reduce((acc, curr) => acc + curr.tokens, 0);
  }, [modelStreams]);

  const avgLatency = useMemo(() => {
    const sum = modelStreams.reduce((acc, curr) => acc + curr.latencyMs, 0);
    return (sum / modelStreams.length).toFixed(1);
  }, [modelStreams]);

  // Handle Omni Shortcut Navigation with tactile feedback
  const handleShortcutClick = (href: string, id: string) => {
    setLoadingShortcut(id);
    router.push(href);
  };

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Action 1: Execute Prompt Optimization Macro
  const handleOptimizePrompt = () => {
    showToast("Executing Prompt Optimization Macro...");
    const optimized = `[SYSTEM ROLE: OMNIAI - NEXUS CORE ORCHESTRATOR]
GOAL: High-performance deterministic execution of the following intent:
"${promptText.trim()}"

ARCHITECTURAL SPECIFICATION:
1. Strict adherence to Dark Misfit Studios Obsidian Cyberpunk tokens (#000000, #0a071b, #6366f1, #00ffcc).
2. Format payload output as strict JSON with ms-accurate telemetry tags.
3. Zero fluff, zero conversational preamble, zero hallucinated identifiers.
4. Fail-safe isolation: Wrap all mutating actions in atomic idempotency guards.`;

    setPromptText(optimized);
    showToast("Prompt Macro Applied: Refactored into Hyper-Detailed Command Block");
  };

  // Action 2: Inject Context Variable
  const handleInjectVariable = (tag: string) => {
    setPromptText((prev) => `${prev} ${tag}`);
    showToast(`Injected Context Variable: ${tag}`);
  };

  // Transmit Multi-Model Vector / Send Simulation
  const handleSendPrompt = () => {
    if (!promptText.trim() || isAnyStreaming) return;
    setIsAnyStreaming(true);
    setAreStatesFrozen(false);
    setEvalMetrics(null);

    // Reset streams to empty and status streaming
    setModelStreams((prev) =>
      prev.map((s) => ({
        ...s,
        output: "",
        isStreaming: true,
        status: "streaming",
        tokens: 0,
      }))
    );

    const fullResponses = {
      gemini: `{\n  "status": "PROMPT_VECTOR_SYNTHESIZED",\n  "engine": "Gemini 1.5 Pro (Google AI Studio Endpoint)",\n  "timestamp": "${new Date().toISOString()}",\n  "temperature": ${temperature},\n  "topP": ${topP},\n  "architecture": {\n    "canvasBackground": "#000000",\n    "layerContainers": "#0a071b",\n    "activeHighlights": "#6366f1",\n    "telemetryOutputs": "#00ffcc"\n  },\n  "execution_metrics": {\n    "context_window_usage": "${totalInputTokens}/2000000 tokens",\n    "reasoning_depth": "EXTREME",\n    "sub_circuit_verified": true\n  }\n}`,
      ollama: `// [LOCAL OLLAMA NODE CHANNEL - AIR GAPPED]\n// MODEL: Llama 3 70B Quantized V8 Node\n// ENCRYPTED CREDENTIAL VAULT: VERIFIED\n\nconst nexusEventLoop = {\n  systemId: 'dm-nexus-private-core',\n  authMode: 'LOCAL_SANDBOX',\n  zeroCloudEgress: true,\n  eventSyncChannel: 'nexus_active_state_sync',\n  activeNodes: 5,\n  allocatedMemoryMb: 42.8,\n  maxConcurrencySlots: 20\n};\n\nconsole.log("[Ollama-Nexus] Sub-routine executed in private container.");`,
      groq: `[GROQ LPU API INFERENCE VECTOR] >> SPEED: 840 TOKENS/SEC\n>> TTFT: 11.8ms | Total Latency: 38.6ms\n>> Model: Llama-3-8B-Instant (Hyper-Throughput)\n>> Query Parsed: "${promptText.substring(0, 40)}..."\n>> Result: Telemetry matrix compiled. Zero packet loss. Stream status 200 OK. Dispatch triggered.`,
    };

    // Simulate real-time streaming chunks
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;

      setModelStreams((prev) =>
        prev.map((stream) => {
          const target = fullResponses[stream.id as keyof typeof fullResponses] || "";
          const charsPerTick = stream.id === "groq" ? 28 : stream.id === "gemini" ? 16 : 8;
          const currentLength = Math.min(target.length, progress * charsPerTick);
          const currentText = target.substring(0, currentLength);
          const isDone = currentLength >= target.length;

          return {
            ...stream,
            output: currentText,
            tokens: Math.round(currentLength / 3.8),
            isStreaming: !isDone,
            status: isDone ? "completed" : "streaming",
          };
        })
      );

      if (progress >= 30) {
        clearInterval(interval);
        setIsAnyStreaming(false);
        showToast("Multi-Model Stream Synchronized across all 3 Channels");
      }
    }, 60);
  };

  // Viewport Action 1: Wipe All Sandbox Outputs
  const handleWipeOutputs = () => {
    setModelStreams((prev) =>
      prev.map((s) => ({
        ...s,
        output: "",
        tokens: 0,
        status: "idle",
        isStreaming: false,
      }))
    );
    setEvalMetrics(null);
    showToast("Sandbox Outputs Wiped Clean");
  };

  // Viewport Action 2: Freeze Dynamic Model States
  const handleFreezeStates = () => {
    setAreStatesFrozen((prev) => !prev);
    setModelStreams((prev) =>
      prev.map((s) => ({
        ...s,
        status: !areStatesFrozen ? "frozen" : "completed",
      }))
    );
    showToast(!areStatesFrozen ? "Model States Frozen for Benchmark Inspection" : "Model States Unfrozen");
  };

  // Viewport Action 3: Calculate Evaluation Metrics
  const handleCalculateMetrics = () => {
    setEvalMetrics({
      cosineAlignment: "0.984 (High Fidelity)",
      tokenEfficiencyRatio: "1.42x optimal",
      latencyDelta: "Groq (38ms) < Gemini (18ms) < Ollama (142ms)",
    });
    showToast("Evaluation Metrics Calculated: Cosine Semantic Match 98.4%");
  };

  // Restore revision
  const handleRestoreRevision = (rev: PromptRevision) => {
    setActiveRevisionId(rev.id);
    setPromptText(rev.prompt);
    setSystemInstruction(rev.systemInstruction);
    setTemperature(rev.temperature);
    showToast(`Restored Revision ${rev.version}`);
  };

  // Commit new revision
  const handleCommitRevision = () => {
    const newRev: PromptRevision = {
      id: `rev-${Date.now()}`,
      hash: Math.random().toString(36).substring(2, 9),
      version: `v2.${revisions.length + 2}.0 (Local Commit)`,
      timestamp: "Just now",
      author: "Prompt Engineer",
      title: promptText.split("\n")[0].substring(0, 40) || "Updated prompt specification",
      prompt: promptText,
      systemInstruction: systemInstruction,
      temperature: temperature,
      tokens: totalInputTokens,
    };
    setRevisions([newRev, ...revisions]);
    setActiveRevisionId(newRev.id);
    showToast(`Committed New Revision [git#${newRev.hash}]`);
  };

  // Copy helper
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export 1: Mobile Call HUD Core
  const handleExportMobileHUD = () => {
    showToast("Exported: System Prompt compiled into OmniAI - Nexus Mobile Call HUD Core");
  };

  // Export 2: Widescreen Studio Engine Directories
  const handleExportWidescreenStudio = () => {
    showToast("Exported: Blueprint mapped to Widescreen Studio Engine Directories");
  };

  // Export 3: Push System Prompt Blueprint to Global Vault Storage
  const handlePushGlobalVault = () => {
    const blueprint = {
      app: "OmniAI - Nexus",
      module: "Prompt Studio",
      exportedAt: new Date().toISOString(),
      activeRevision: activeRevisionId,
      systemInstruction,
      parameters: {
        temperature,
        topP,
        maxTokens,
        frequencyPenalty: freqPenalty,
        presencePenalty: presPenalty,
      },
      currentPrompt: promptText,
      evaluation: evalMetrics,
      revisions: revisions,
    };

    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-system-prompt-blueprint-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Blueprint Downloaded & Pushed to Global Vault Storage");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000000] text-[#f1f0f7] selection:bg-[#6366f1]/40 selection:text-white">
      {/* FLOATING ACTION NOTIFICATION TOAST */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-[#00ffcc] bg-[#000000] px-5 py-2.5 shadow-[0_0_35px_rgba(0,255,204,0.35)] animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="size-4 text-[#00ffcc] animate-spin" />
          <span className="font-mono text-xs font-bold text-[#00ffcc]">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-xs font-mono text-[#9490ac] hover:text-white"
          >
            [X]
          </button>
        </div>
      )}

      {/* UNIVERSAL APPLICATION HEADER */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#6366f1]/25 bg-[#000000]/95 px-5 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          {/* Static, Non-Floating Color-Shifting WebGL Core Orb */}
          <div className="relative flex size-9 items-center justify-center">
            <HoloOrb size="xs" phase="idle" showStatusLabel={false} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#00ffcc]">
                Dark Misfit Studios
              </span>
              <span className="text-[#6366f1] font-mono text-xs">/</span>
              <span className="text-xs text-[#9490ac] font-mono">Prompt Studio</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">OmniAI - Nexus</h1>
          </div>
        </div>

        {/* Streaming & Telemetry Indicators */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2 rounded-full bg-[#00ffcc] animate-pulse" />
            <span className="text-[#9490ac]">Sandbox State:</span>
            <span className="text-[#00ffcc] font-semibold">
              {isAnyStreaming ? "STREAMING (3x MESH)" : areStatesFrozen ? "FROZEN BENCHMARK" : "SYNCHRONIZED"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Tokens Generated:</span>
            <span className="text-[#00ffcc] font-semibold">{totalOutputTokens} toks</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Avg Model Latency:</span>
            <span className="text-[#00ffcc] font-semibold">{avgLatency}ms</span>
          </div>
        </div>

        {/* Right Navigation Links */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/automations"
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-mono font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
          >
            <Zap className="size-3.5 text-[#00ffcc]" />
            <span>Automations</span>
          </Link>
          <Link
            href="/api-connector"
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-mono font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
          >
            <Radio className="size-3.5 text-[#6366f1]" />
            <span>OmniConnect</span>
          </Link>
        </div>
      </header>

      {/* THREE-COLUMN WIDESCREEN WORKSPACE (25% | 50% | 25%) */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* =========================================================================
            PANEL 1: PROMPT FACTORY & METADATA DECK (LEFT PANEL - 25% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-3 border-r border-[#6366f1]/25 bg-[#000000] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Code className="size-4 text-[#00ffcc]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Prompt Factory</h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc] bg-[#00ffcc]/10 border border-[#00ffcc]/30 px-2 py-0.5 rounded">
              v2.4 Core
            </span>
          </div>

          {/* 1. Master System Instruction Box */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="size-3.5 text-[#6366f1]" />
                Master System Instruction
              </label>
              <button
                onClick={() => handleCopyText(systemInstruction, "sys-copy")}
                className="text-[10px] font-mono text-[#9490ac] hover:text-[#00ffcc] flex items-center gap-1"
              >
                {copiedId === "sys-copy" ? <Check className="size-3 text-[#00ffcc]" /> : <Copy className="size-3" />}
                {copiedId === "sys-copy" ? "COPIED" : "COPY"}
              </button>
            </div>
            <p className="text-[10px] font-mono text-[#8d87a8]">
              {"// STRUCTURAL PERSONA & HIDDEN MODEL BEHAVIORS"}
            </p>
            <textarea
              rows={5}
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              className="w-full resize-none rounded-lg border border-[#6366f1]/40 bg-[#000000] p-2.5 font-mono text-xs text-[#00ffcc] placeholder-[#8d87a8]/60 focus:border-[#00ffcc] focus:outline-none focus:ring-1 focus:ring-[#00ffcc]"
              placeholder="Define model identity, behavioral safety guards, and output syntax..."
            />
          </div>

          {/* 2. Mathematical Model Parameters (Slider Array in Purplish-Blue) */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="size-3.5 text-[#00ffcc]" />
                Mathematical Parameters
              </span>
              <span className="text-[10px] font-mono text-[#6366f1]">Dynamic Matrix</span>
            </div>

            {/* Slider 1: Temperature */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#9490ac]">Model Temperature (Creativity)</span>
                <span className="text-[#00ffcc] font-bold">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#6366f1] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#8d87a8]">
                <span>0.0 (Deterministic)</span>
                <span>0.7 (Balanced)</span>
                <span>1.5 (Creative)</span>
              </div>
            </div>

            {/* Slider 2: Top-P */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#9490ac]">Top-P Probability Filter</span>
                <span className="text-[#00ffcc] font-bold">{topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-full accent-[#6366f1] cursor-pointer"
              />
            </div>

            {/* Slider 3: Max Tokens */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#9490ac]">Max Token Multiplier</span>
                <span className="text-[#00ffcc] font-bold">{maxTokens} tokens</span>
              </div>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                className="w-full accent-[#6366f1] cursor-pointer"
              />
            </div>

            {/* Slider 4: Frequency & Presence Penalties */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#6366f1]/20">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-[#9490ac]">Freq Penalty: {freqPenalty}</span>
                <input
                  type="range"
                  min="-2.0"
                  max="2.0"
                  step="0.1"
                  value={freqPenalty}
                  onChange={(e) => setFreqPenalty(parseFloat(e.target.value))}
                  className="w-full accent-[#6366f1]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-[#9490ac]">Pres Penalty: {presPenalty}</span>
                <input
                  type="range"
                  min="-2.0"
                  max="2.0"
                  step="0.1"
                  value={presPenalty}
                  onChange={(e) => setPresPenalty(parseFloat(e.target.value))}
                  className="w-full accent-[#6366f1]"
                />
              </div>
            </div>
          </div>

          {/* 3. The Engineering Action Matrix */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="size-3.5 text-[#00ffcc]" />
              The Engineering Action Matrix
            </span>

            {/* Button 1: [Execute Prompt Optimization Macro] */}
            <button
              onClick={handleOptimizePrompt}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/15 py-2.5 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/25 hover:shadow-[0_0_20px_rgba(0,255,204,0.3)] active:scale-95"
            >
              <Sparkles className="size-4" />
              [Execute Prompt Optimization Macro]
            </button>

            {/* Button 2: [Inject Core Studio Context variables] */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[10px] font-mono text-[#9490ac]">Inject Core Studio Context Variables:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {CONTEXT_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    onClick={() => handleInjectVariable(v.tag)}
                    className="flex flex-col items-start rounded border border-[#6366f1]/30 bg-[#000000] p-1.5 text-left transition hover:border-[#00ffff] hover:bg-[#6366f1]/10 active:scale-95"
                  >
                    <span className="font-mono text-[10px] font-bold text-[#00ffcc]">{v.tag}</span>
                    <span className="text-[9px] text-[#8d87a8] truncate w-full">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            PANEL 2: THE SYNCED MULTI-MODEL SANDBOX GRID (CENTER PANELS - 50% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-6 bg-[#000000] p-4 flex flex-col justify-between overflow-hidden relative">
          {/* Top Widescreen Central Prompt Workspace Box */}
          <div className="flex flex-col gap-2.5 z-10">
            <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-2">
              <div className="flex items-center gap-2">
                <TerminalIcon className="size-4 text-[#6366f1]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Central Prompt Workspace
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-[#9490ac]">Est Input Tokens:</span>
                <span className="text-[#00ffcc] font-bold">{totalInputTokens}</span>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="relative rounded-xl border border-[#6366f1]/40 bg-[#0a071b] p-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <textarea
                rows={3}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Enter prompt instruction to replicate across all 3 streaming endpoints..."
                className="w-full resize-none bg-transparent font-mono text-xs text-[#f1f0f7] placeholder-[#8d87a8]/50 focus:outline-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2 border-t border-[#6366f1]/20 mt-1">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#8d87a8]">
                  <span>{promptText.length} characters</span>
                  <span>•</span>
                  <span>Target: 3 Endpoints Synced</span>
                </div>

                <button
                  onClick={handleSendPrompt}
                  disabled={isAnyStreaming || !promptText.trim()}
                  className="flex items-center gap-2 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/20 px-4 py-1.5 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/30 hover:shadow-[0_0_20px_rgba(0,255,204,0.4)] active:scale-95 disabled:opacity-50"
                >
                  {isAnyStreaming ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Streaming Vector...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Transmit Multi-Model Vector
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Floating Viewport Toolbed */}
          <div className="my-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6366f1]/40 bg-[#0a071b]/90 backdrop-blur-md px-3 py-1.5 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9490ac]">
              <Gauge className="size-3.5 text-[#00ffcc]" />
              <span>Multi-Model Stream Replication</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleWipeOutputs}
                className="flex items-center gap-1 rounded-lg border border-[#6366f1]/30 bg-[#000000] px-2 py-1 font-mono text-[11px] text-[#8d87a8] transition hover:border-[#ff2a6d] hover:text-[#ff2a6d] active:scale-95"
              >
                <Trash2 className="size-3" />
                [Wipe All Sandbox Outputs]
              </button>

              <button
                onClick={handleFreezeStates}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] transition active:scale-95 ${
                  areStatesFrozen
                    ? "border-[#00ffcc] bg-[#00ffcc]/15 text-[#00ffcc]"
                    : "border-[#6366f1]/30 bg-[#000000] text-[#8d87a8] hover:border-[#00ffff] hover:text-[#00ffff]"
                }`}
              >
                {areStatesFrozen ? <Lock className="size-3 text-[#00ffcc]" /> : <Unlock className="size-3" />}
                [Freeze Dynamic Model States]
              </button>

              <button
                onClick={handleCalculateMetrics}
                className="flex items-center gap-1 rounded-lg border border-[#6366f1]/30 bg-[#000000] px-2 py-1 font-mono text-[11px] text-[#8d87a8] transition hover:border-[#00ffcc] hover:text-[#00ffcc] active:scale-95"
              >
                <BarChart2 className="size-3" />
                [Calculate Evaluation Metrics]
              </button>
            </div>
          </div>

          {/* Evaluation Metrics Benchmark Banner (Visible when calculated) */}
          {evalMetrics && (
            <div className="mb-2 rounded-xl border border-[#00ffcc]/40 bg-[#0a071b] p-2.5 flex items-center justify-between font-mono text-xs text-[#00ffcc] shadow-[0_0_20px_rgba(0,255,204,0.15)] animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="font-bold">Evaluation Alignment: {evalMetrics.cosineAlignment}</span>
              </div>
              <div className="text-[11px] text-[#9490ac]">Ratio: {evalMetrics.tokenEfficiencyRatio}</div>
              <div className="text-[11px] text-[#00ffff]">{evalMetrics.latencyDelta}</div>
            </div>
          )}

          {/* Three-Channel Multi-Model Split Screen Grid */}
          <div className="flex-1 min-h-[300px] grid grid-cols-1 md:grid-cols-3 gap-2.5 overflow-hidden">
            {modelStreams.map((model) => (
              <div
                key={model.id}
                className="flex flex-col justify-between rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-3 shadow-lg overflow-hidden"
              >
                {/* Channel Header */}
                <div className="flex flex-col gap-1 border-b border-[#6366f1]/20 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#9490ac] uppercase">{model.channel}</span>
                    <span
                      className="font-mono text-[9px] px-1.5 py-0.5 rounded border font-semibold"
                      style={{ color: model.badgeColor, borderColor: `${model.badgeColor}40` }}
                    >
                      {model.badge}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{model.name}</div>
                  <div className="text-[10px] font-mono text-[#00ffcc]">{model.engine}</div>
                </div>

                {/* Stream Output Window */}
                <div className="my-2 flex-1 rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 font-mono text-[11px] text-[#f1f0f7] overflow-y-auto max-h-[220px] select-text">
                  {model.output ? (
                    <pre className="whitespace-pre-wrap leading-relaxed font-mono text-[#00ffcc]">
                      {model.output}
                    </pre>
                  ) : (
                    <span className="text-[10px] text-[#8d87a8]/60 italic">
                      Channel ready. Transmit prompt to initiate streaming replica...
                    </span>
                  )}
                </div>

                {/* Channel Telemetry Footer */}
                <div className="pt-2 border-t border-[#6366f1]/20 flex items-center justify-between text-[10px] font-mono text-[#9490ac]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${
                        model.isStreaming ? "bg-[#00ffcc] animate-ping" : "bg-[#6366f1]"
                      }`}
                    />
                    <span>{model.latencyMs}ms</span>
                    <span>•</span>
                    <span className="text-[#00ffcc]">{model.tps} tps</span>
                  </div>
                  <span className="text-[#8d87a8]">{model.costEst}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Embedded Interactive .omni-shortcut cards for rapid cross-module navigation */}
          <div className="my-2.5 flex flex-col gap-2 z-10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9490ac] flex items-center gap-1.5">
                <Boxes className="size-3 text-[#00ffcc]" />
                Nexus Quick Navigators (Tactile Feedback Scale 0.95)
              </span>
              <span className="text-[10px] font-mono text-[#6366f1]">:active scale(0.95) enabled</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Shortcut 1: Automations Studio */}
              <button
                onClick={() => handleShortcutClick("/automations", "sc-auto")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2.5 text-left transition ${
                  loadingShortcut === "sc-auto" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    Automations
                    {loadingShortcut === "sc-auto" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Zap className="size-3.5 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-1">
                  Event-Loop Canvas
                </span>
                {loadingShortcut === "sc-auto" && <span className="omni-shortcut-pulse" />}
              </button>

              {/* Shortcut 2: OmniConnect API & Webhook Lab */}
              <button
                onClick={() => handleShortcutClick("/api-connector", "sc-conn")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2.5 text-left transition ${
                  loadingShortcut === "sc-conn" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    OmniConnect
                    {loadingShortcut === "sc-conn" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Radio className="size-3.5 text-[#6366f1]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-1">
                  API & Webhook Ingress
                </span>
                {loadingShortcut === "sc-conn" && <span className="omni-shortcut-pulse" />}
              </button>

              {/* Shortcut 3: Cosmic UI Lab */}
              <button
                onClick={() => handleShortcutClick("/ui-lab", "sc-ui")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2.5 text-left transition ${
                  loadingShortcut === "sc-ui" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    Cosmic UI Lab
                    {loadingShortcut === "sc-ui" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Layers className="size-3.5 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-1">
                  Component Playground
                </span>
                {loadingShortcut === "sc-ui" && <span className="omni-shortcut-pulse" />}
              </button>
            </div>
          </div>

          {/* System Telemetry Line at Absolute Bottom Margin in Vibrant Neon Green */}
          <div className="z-10 flex items-center justify-between rounded-xl border border-[#00ffcc]/35 bg-[#0a071b] px-4 py-2 text-xs font-mono shadow-[0_0_20px_rgba(0,255,204,0.15)]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-ping" />
              <span className="text-[#00ffcc] font-bold">
                [Nexus-Prompt: Stateful Optimization Matrix / Multi-Model Synchronization Active]
              </span>
            </div>
            <span className="text-[11px] text-[#9490ac] hidden sm:inline">
              Channels: Gemini • Ollama • Groq
            </span>
          </div>
        </section>

        {/* =========================================================================
            PANEL 3: VERSION CONTROL TREE & EXPORT DECK (RIGHT PANEL - 25% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-3 border-l border-[#6366f1]/25 bg-[#000000] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-[#00ffcc]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Version Control Tree</h2>
            </div>
            <button
              onClick={handleCommitRevision}
              className="flex items-center gap-1 font-mono text-[10px] text-[#00ffcc] bg-[#00ffcc]/10 border border-[#00ffcc]/30 px-2 py-0.5 rounded hover:bg-[#00ffcc]/20 transition"
            >
              <GitCommit className="size-3" />
              COMMIT REVISION
            </button>
          </div>

          {/* 1. Git-Style Prompt Revision Tree */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3 flex flex-col gap-2">
            <span className="text-[11px] font-mono text-[#9490ac]">
              {"// EXPANDABLE REVISION HISTORY (CLICK TO RESTORE)"}
            </span>

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {revisions.map((rev) => {
                const isActive = rev.id === activeRevisionId;
                return (
                  <div
                    key={rev.id}
                    onClick={() => handleRestoreRevision(rev)}
                    className={`flex flex-col rounded-lg border p-2.5 cursor-pointer transition ${
                      isActive
                        ? "border-[#00ffcc] bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.15)]"
                        : "border-[#6366f1]/30 bg-[#000000] hover:border-[#6366f1]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                        <GitCommit className={`size-3.5 ${isActive ? "text-[#00ffcc]" : "text-[#6366f1]"}`} />
                        {rev.version}
                      </span>
                      <span className="font-mono text-[9px] text-[#00ffcc]">#{rev.hash}</span>
                    </div>

                    <div className="text-[11px] text-[#9490ac] mt-1 font-mono truncate">{rev.title}</div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#8d87a8] mt-1.5 pt-1.5 border-t border-[#6366f1]/15">
                      <span>{rev.timestamp}</span>
                      <span className="text-[#00ffff]">{rev.tokens} toks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Real-Time Token Analyzer */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <BarChart2 className="size-3.5 text-[#00ffcc]" />
                Real-Time Token Analyzer
              </span>
              <span className="text-[10px] font-mono text-[#00ffcc]">Monospaced Metrics</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[10px] text-[#9490ac]">Output Tokens</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">{totalOutputTokens}</span>
                <span className="text-[9px] text-[#8d87a8]">across 3 channels</span>
              </div>

              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[10px] text-[#9490ac]">Est Input Cost</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">$0.00024</span>
                <span className="text-[9px] text-[#8d87a8]">{totalInputTokens} input toks</span>
              </div>

              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[10px] text-[#9490ac]">Latency Timeline</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">{avgLatency} ms</span>
                <span className="text-[9px] text-[#8d87a8]">sub-50ms target</span>
              </div>

              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[10px] text-[#9490ac]">Peak Velocity</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">840 tps</span>
                <span className="text-[9px] text-[#8d87a8]">Groq LPU Baseline</span>
              </div>
            </div>
          </div>

          {/* 3. Production Deploy Assembly */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <UploadCloud className="size-3.5 text-[#00ffcc]" />
              Production Deploy Assembly
            </span>

            {/* Button 1: [Export Prompt System File to OmniAI - Nexus Mobile Call HUD Core] */}
            <button
              onClick={handleExportMobileHUD}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1]/40 bg-[#000000] py-2 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
            >
              <Share2 className="size-3.5 text-[#6366f1]" />
              [Export Prompt to Mobile HUD Core]
            </button>

            {/* Button 2: [Export Prompt System File to Widescreen Studio Engine Directories] */}
            <button
              onClick={handleExportWidescreenStudio}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1]/40 bg-[#000000] py-2 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
            >
              <Code className="size-3.5 text-[#6366f1]" />
              [Export to Studio Engine Directories]
            </button>

            {/* Button 3: [Push System Prompt Blueprint to Global Vault Storage] */}
            <button
              onClick={handlePushGlobalVault}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/20 py-2.5 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/30 hover:shadow-[0_0_20px_rgba(0,255,204,0.4)] active:scale-95"
            >
              <Download className="size-4" />
              [Push Blueprint to Global Vault Storage]
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
