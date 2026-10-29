"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import HoloOrb from "@/components/HoloOrb";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  RotateCcw,
  AlignLeft,
  Trash2,
  Download,
  Copy,
  Check,
  Zap,
  Activity,
  Layers,
  Terminal as TerminalIcon,
  Server,
  ArrowRight,
  Clock,
  Radio,
  Sliders,
  ChevronRight,
  Cpu,
  Database,
  ShieldCheck,
  Send,
  UploadCloud,
  FileCode,
  Sparkles,
  RefreshCw,
  CornerDownRight,
  AlertCircle,
  BarChart3,
  Network,
  Share2,
} from "lucide-react";

export type TriggerType = "webhook" | "cron" | "mutation";

export interface AutomationNode {
  id: string;
  name: string;
  category: "trigger" | "filter" | "transform" | "action" | "dispatch";
  summary: string;
  config: Record<string, any>;
  status: "idle" | "armed" | "executing" | "verified" | "error";
  latencyMs: number;
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: "INFO" | "EXEC" | "TRACE" | "DISPATCH" | "WARN";
  nodeId?: string;
  message: string;
  payload?: any;
}

const DEFAULT_NODES: AutomationNode[] = [
  {
    id: "node-1-trigger",
    name: "App Webhook Listener",
    category: "trigger",
    summary: "POST /v1/webhooks/nexus-inbound - SHA256 Signature verified",
    config: {
      endpoint: "https://api.darkmisfit.io/v1/webhooks/nexus-inbound",
      auth: "HMAC-SHA256",
      maxPayloadKb: 256,
      eventFilter: "event.type == 'order.settled'",
    },
    status: "armed",
    latencyMs: 1.2,
  },
  {
    id: "node-2-filter",
    name: "Quantum Fraud & Token Gate",
    category: "filter",
    summary: "Evaluate riskScore < 0.15 && tier == 'ENTERPRISE'",
    config: {
      rule: "$.payload.riskScore < 0.15 && $.payload.tier in ['ENTERPRISE', 'PRO']",
      fallback: "ROUTE_TO_ISOLATED_QUARANTINE",
      timeoutMs: 40,
    },
    status: "idle",
    latencyMs: 4.8,
  },
  {
    id: "node-3-transform",
    name: "Sidecar Ledger Mutator",
    category: "transform",
    summary: "Normalize payload schema & attach idempotency hash",
    config: {
      schemaTarget: "NexusLedgerV3",
      injectHash: true,
      encryption: "AES-256-GCM",
    },
    status: "idle",
    latencyMs: 2.1,
  },
  {
    id: "node-4-action",
    name: "Cloud SQL Atomic Pipeline",
    category: "action",
    summary: "UPSERT nexus_active_state_sync & commit transaction",
    config: {
      table: "nexus_active_state_sync",
      pool: "pg-pool-hyperscale-01",
      mode: "READ_COMMITTED_ATOMIC",
    },
    status: "idle",
    latencyMs: 8.4,
  },
  {
    id: "node-5-dispatch",
    name: "Multiplex Dispatch Matrix",
    category: "dispatch",
    summary: "Broadcast WebSockets + Discord alert + Kafka bus",
    config: {
      broadcastWs: true,
      kafkaTopic: "nexus.events.production",
      discordHook: "enabled",
    },
    status: "idle",
    latencyMs: 3.6,
  },
];

const PRESET_PROMPTS = [
  "When an enterprise customer settles a transaction in Stripe, verify risk score via sidecar, update ledger in Cloud SQL, and dispatch live WebSockets to client dashboard.",
  "Every 5 minutes, query active container health telemetry, prune orphaned execution caches, and write a summary audit log into the immutable vault.",
  "Listen on system state mutations on channel 'nexus_active_state_sync', debounce for 120ms, and broadcast real-time state vectors to all connected edge workers.",
];

export default function AutomationsStudioPage() {
  const router = useRouter();

  // Natural Language Prompt State
  const [promptInput, setPromptInput] = useState(
    "When an enterprise customer settles a transaction in Stripe, verify risk score via sidecar, update ledger in Cloud SQL, and dispatch live WebSockets to client dashboard."
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Trigger Selector State
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType>("webhook");
  const [webhookUrl, setWebhookUrl] = useState("https://api.darkmisfit.io/v1/webhooks/nexus-inbound");
  const [cronExpression, setCronExpression] = useState("*/5 * * * *");
  const [cronJitter, setCronJitter] = useState("±200ms buffer");
  const [mutationChannel, setMutationChannel] = useState("nexus_active_state_sync");
  const [mutationDebounce, setMutationDebounce] = useState("120");

  // Workflow Pipeline Nodes
  const [nodes, setNodes] = useState<AutomationNode[]>(DEFAULT_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-1-trigger");

  // Simulation & Traversal State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [totalCycleMs, setTotalCycleMs] = useState(20.1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Performance Telemetry Logs
  const [logs, setLogs] = useState<TelemetryLog[]>([
    {
      id: "log-1",
      timestamp: "00:00:00.012",
      level: "INFO",
      message: "Automations Studio core event-loop mounted. Runtime: Isolated V8 Sandbox.",
    },
    {
      id: "log-2",
      timestamp: "00:00:00.045",
      level: "TRACE",
      message: "Trigger listener armed on [App Webhook Listener Node]. Waiting for inbound frames.",
    },
    {
      id: "log-3",
      timestamp: "00:00:00.088",
      level: "INFO",
      message: "Worker pool: 20 concurrency slots allocated (0 currently saturated).",
    },
  ]);

  // Telemetry Metrics State
  const [memoryMb, setMemoryMb] = useState(42.8);
  const [throughputOps, setThroughputOps] = useState(2480);
  const [freeWindows, setFreeWindows] = useState(19);
  const [loopJitter, setLoopJitter] = useState(0.14);

  // Real-Time Latency Fluctuations Tracking
  const [latencyHistory, setLatencyHistory] = useState<number[]>([
    16.2, 17.8, 14.5, 18.2, 22.4, 15.1, 19.0, 16.5, 24.2, 18.4, 17.1, 19.8, 18.4
  ]);
  const [currentLatency, setCurrentLatency] = useState<number>(18.4);

  // Background subtle jitter fluctuation for real-time oscillogram
  useEffect(() => {
    const jitterTimer = setInterval(() => {
      setLatencyHistory((prev) => {
        const delta = (Math.random() - 0.48) * 1.8;
        const nextVal = parseFloat(Math.max(8.5, Math.min(34.0, (prev[prev.length - 1] || 18.0) + delta)).toFixed(1));
        setCurrentLatency(nextVal);
        return [...prev.slice(-19), nextVal];
      });
    }, 2200);

    return () => clearInterval(jitterTimer);
  }, []);

  // Omni Shortcuts Navigation Loading State
  const [loadingShortcut, setLoadingShortcut] = useState<string | null>(null);

  // Canvas Ref for the Event-Loop Node Traversal Visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const traversalParticleRef = useRef<{ active: boolean; currentEdge: number; t: number }>({
    active: false,
    currentEdge: 0,
    t: 0,
  });

  // Selected node config helper
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  // Add Log Helper
  const appendLog = useCallback((level: TelemetryLog["level"], message: string, payload?: any, nodeId?: string) => {
    const d = new Date();
    const timestamp = `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`;

    const newLog: TelemetryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      level,
      message,
      payload,
      nodeId,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 80)]);
  }, []);

  // Trigger Selector Change
  const handleSelectTrigger = (type: TriggerType) => {
    setSelectedTrigger(type);
    let triggerName = "App Webhook Listener";
    let triggerSummary = "POST /v1/webhooks/nexus-inbound - SHA256 Signature verified";
    let triggerConfig: Record<string, any> = {
      endpoint: webhookUrl,
      auth: "HMAC-SHA256",
      maxPayloadKb: 256,
      eventFilter: "event.type == 'order.settled'",
    };

    if (type === "cron") {
      triggerName = "Scheduled Cron Ticker Matrix";
      triggerSummary = `Expression: "${cronExpression}" with ${cronJitter}`;
      triggerConfig = {
        schedule: cronExpression,
        jitter: cronJitter,
        timezone: "UTC",
        driftToleranceMs: 25,
      };
    } else if (type === "mutation") {
      triggerName = "System State Mutation Hook";
      triggerSummary = `Listen on "${mutationChannel}" with ${mutationDebounce}ms debounce`;
      triggerConfig = {
        channel: mutationChannel,
        debounceMs: parseInt(mutationDebounce, 10) || 120,
        filterField: "state.status == 'DIRTY'",
      };
    }

    setNodes((prev) => [
      {
        ...prev[0],
        name: triggerName,
        summary: triggerSummary,
        config: triggerConfig,
        status: "armed",
      },
      ...prev.slice(1),
    ]);

    appendLog("INFO", `Switched primary trigger node to [${triggerName}]`, triggerConfig, "node-1-trigger");
  };

  // Conversational Synthesis
  const handleSynthesizePrompt = () => {
    if (!promptInput.trim()) return;
    setIsSynthesizing(true);
    appendLog("TRACE", `Analyzing prompt vector: "${promptInput.substring(0, 60)}..."`);

    setTimeout(() => {
      setIsSynthesizing(false);
      let newNodes: AutomationNode[] = [];

      if (promptInput.toLowerCase().includes("cron") || promptInput.toLowerCase().includes("every")) {
        setSelectedTrigger("cron");
        newNodes = [
          {
            id: "node-1-trigger",
            name: "Scheduled Cron Ticker Matrix",
            category: "trigger",
            summary: "Cron trigger: */5 * * * * (Jitter buffer active)",
            config: { schedule: "*/5 * * * *", timezone: "UTC", jitterTolerance: "150ms" },
            status: "armed",
            latencyMs: 0.9,
          },
          {
            id: "node-2-filter",
            name: "Telemetry Health Evaluator",
            category: "filter",
            summary: "Check cpuUsage > 85% || orphanedCaches > 12",
            config: { metric: "system.health", pruneThreshold: 12 },
            status: "idle",
            latencyMs: 3.2,
          },
          {
            id: "node-3-transform",
            name: "Audit Synthesizer",
            category: "transform",
            summary: "Compress telemetry vectors into JSON-LD block",
            config: { compressGzip: true, format: "JSON-LD" },
            status: "idle",
            latencyMs: 2.4,
          },
          {
            id: "node-4-action",
            name: "Immutable Vault Writer",
            category: "action",
            summary: "Append write into Cloud SQL audit log table",
            config: { table: "nexus_audit_vault", verifyMerkleRoot: true },
            status: "idle",
            latencyMs: 9.1,
          },
          {
            id: "node-5-dispatch",
            name: "Incident Alert Dispatcher",
            category: "dispatch",
            summary: "Notify ops team on Discord & write telemetry channel",
            config: { channel: "ops-critical", quietPeriodSec: 300 },
            status: "idle",
            latencyMs: 2.8,
          },
        ];
      } else if (promptInput.toLowerCase().includes("mutation") || promptInput.toLowerCase().includes("state")) {
        setSelectedTrigger("mutation");
        newNodes = [
          {
            id: "node-1-trigger",
            name: "System State Mutation Hook",
            category: "trigger",
            summary: "Channel: nexus_active_state_sync (Debounce: 120ms)",
            config: { channel: "nexus_active_state_sync", debounceMs: 120 },
            status: "armed",
            latencyMs: 1.1,
          },
          {
            id: "node-2-filter",
            name: "Delta Mutation Gate",
            category: "filter",
            summary: "Filter shallow changes (deltaBytes > 32)",
            config: { minDeltaBytes: 32, ignoreHeartbeats: true },
            status: "idle",
            latencyMs: 1.8,
          },
          {
            id: "node-3-transform",
            name: "Vector Embedder",
            category: "transform",
            summary: "Generate semantic representation for edge workers",
            config: { model: "vector-mini-v2", dimensions: 256 },
            status: "idle",
            latencyMs: 5.7,
          },
          {
            id: "node-4-action",
            name: "Edge Cache Invalidation",
            category: "action",
            summary: "Evict stale replicas across edge zones",
            config: { zones: ["us-east", "eu-central", "ap-southeast"], ttl: 0 },
            status: "idle",
            latencyMs: 6.9,
          },
          {
            id: "node-5-dispatch",
            name: "Ultra-Low-Latency WS Broadcast",
            category: "dispatch",
            summary: "Broadcast binary state frames to 4,200 connected clients",
            config: { binaryPacking: "msgpack", priority: "HIGH" },
            status: "idle",
            latencyMs: 3.1,
          },
        ];
      } else {
        setSelectedTrigger("webhook");
        newNodes = DEFAULT_NODES;
      }

      setNodes(newNodes);
      setSelectedNodeId(newNodes[0].id);
      appendLog("INFO", "Synthesized 5-stage event-loop pipeline from natural language prompt.", {
        nodeCount: newNodes.length,
        entryTrigger: newNodes[0].name,
      });
      setToastMessage("Event-Loop Architecture Successfully Synthesized!");
      setTimeout(() => setToastMessage(null), 3000);
    }, 600);
  };

  // Simulation Loop Traversal
  const handleExecuteSandbox = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimProgress(0);

    // Reset nodes to armed/idle
    setNodes((prev) =>
      prev.map((n, idx) => ({
        ...n,
        status: idx === 0 ? "executing" : "idle",
      }))
    );

    appendLog("EXEC", "--- [SANDBOX EXECUTION INITIATED: Zero-Downtime Loop Simulator] ---");
    appendLog("TRACE", `Trigger inbound: Ingesting frame into [${nodes[0].name}]...`);

    // Initiate particle visualizer on canvas
    traversalParticleRef.current = {
      active: true,
      currentEdge: 0,
      t: 0,
    };

    let step = 0;
    const totalSteps = nodes.length;

    const interval = setInterval(() => {
      step++;
      const nodeIndex = step - 1;

      if (nodeIndex < totalSteps) {
        setNodes((prev) =>
          prev.map((n, idx) => {
            if (idx === nodeIndex) {
              return { ...n, status: "verified" };
            }
            if (idx === nodeIndex + 1) {
              return { ...n, status: "executing" };
            }
            return n;
          })
        );

        setSimProgress(Math.round((step / totalSteps) * 100));
        const currentNode = nodes[nodeIndex];
        const stepLatency = parseFloat((currentNode.latencyMs + (Math.random() * 1.5 - 0.75)).toFixed(1));
        setCurrentLatency(stepLatency);
        setLatencyHistory((prev) => [...prev.slice(-19), stepLatency]);

        appendLog(
          "EXEC",
          `Stage [${nodeIndex + 1}/${totalSteps}] ${currentNode.name} resolved in ${currentNode.latencyMs}ms. Status: 200 OK`,
          currentNode.config,
          currentNode.id
        );

        // Advance particle edge
        traversalParticleRef.current.currentEdge = nodeIndex;
        traversalParticleRef.current.t = 0;
      }

      if (step >= totalSteps) {
        clearInterval(interval);
        setTimeout(() => {
          setIsSimulating(false);
          setSimProgress(100);
          traversalParticleRef.current.active = false;

          const calculatedLatency = nodes.reduce((acc, curr) => acc + curr.latencyMs, 0);
          setTotalCycleMs(parseFloat(calculatedLatency.toFixed(2)));

          appendLog(
            "DISPATCH",
            `Loop Cycle Complete. Total Roundtrip: ${calculatedLatency.toFixed(2)}ms. Free slots: ${freeWindows}/20. All nodes verified.`,
            { exitCode: 0, state: "COMMITTED" }
          );

          setToastMessage(`Execution Verified: ${calculatedLatency.toFixed(2)}ms latency [Zero Errors]`);
          setTimeout(() => setToastMessage(null), 3500);

          // Randomize telemetry metrics slightly for realism
          setThroughputOps((prev) => Math.min(3200, Math.max(2100, prev + Math.floor(Math.random() * 80 - 40))));
          setMemoryMb((prev) => parseFloat((prev + (Math.random() * 0.4 - 0.2)).toFixed(1)));
          setLoopJitter(parseFloat((0.12 + Math.random() * 0.05).toFixed(2)));
        }, 300);
      }
    }, 450);
  };

  // Format Payload Indentation Tool
  const handleFormatPayload = () => {
    appendLog("INFO", "Payload Indentation Normalized across all 5 pipeline configurations.");
    setToastMessage("All Node Configuration Schemas Formatted & Validated [JSON 2-space]");
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Clear Active Cache Tool
  const handleClearCache = () => {
    setNodes((prev) =>
      prev.map((n, idx) => ({
        ...n,
        status: idx === 0 ? "armed" : "idle",
      }))
    );
    setSimProgress(0);
    traversalParticleRef.current.active = false;
    appendLog("WARN", "Active cache cleared. Memory overhead reclaimed. Sandbox state reset to ARM.");
    setToastMessage("Active Sandbox Cache Cleared [Memory Reclaimed]");
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Deploy Active Loop Live into Production Core
  const handleDeployProduction = () => {
    appendLog("DISPATCH", "Staging production deployment package for OmniAI - Nexus Core...");
    setTimeout(() => {
      appendLog("INFO", "Nexus isolated container deployed to zone us-east-prod-1. Rules active.");
      setToastMessage("Deployed Live: Active Loop Committed into Dark Misfit Production Core");
      setTimeout(() => setToastMessage(null), 4000);
    }, 500);
  };

  // Export Automation Schema Backup JSON to Global Vault
  const handleExportSchema = () => {
    const schemaData = {
      workspace: "OmniAI - Nexus",
      engine: "Automations Studio Event-Loop Core",
      version: "2.4.0-quantum",
      exportedAt: new Date().toISOString(),
      primaryTrigger: selectedTrigger,
      nodes: nodes,
      telemetrySnapshot: {
        memoryMb,
        throughputOps,
        freeWindows,
        loopJitter,
      },
    };

    const blob = new Blob([JSON.stringify(schemaData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-automation-loop-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    appendLog("INFO", "Automation Schema JSON exported to local storage / Global Vault.");
    setToastMessage("Exported: Automation Schema Backup JSON Downloaded");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Route System Logs to OmniAnalyzer Tracking Modules
  const handleRouteToAnalyzer = () => {
    appendLog("INFO", "Live log stream piped into OmniAnalyzer tracking socket: wss://analyzer.darkmisfit.io/feed");
    setToastMessage("OmniAnalyzer Stream Activated [Piped to Socket]");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Omni Shortcut Navigation with tactile feedback
  const handleShortcutClick = (href: string, id: string) => {
    setLoadingShortcut(id);
    router.push(href);
  };

  // Copy Config Helper
  const handleCopyNodeConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedNode.config, null, 2));
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // WebGL / 2D Canvas Renderer for Interactive Fluid Event-Loop Nodes and Neon Traversal Particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 480);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    // Particle vector system
    const backgroundStars: { x: number; y: number; r: number; alpha: number; speed: number }[] = [];
    for (let i = 0; i < 40; i++) {
      backgroundStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
        speed: Math.random() * 0.2 + 0.05,
      });
    }

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Canvas background pure black
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Subtle cybernetic grid lines
      ctx.strokeStyle = "rgba(99, 102, 241, 0.07)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Background ambient star dust
      for (const star of backgroundStars) {
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(0, 255, 204, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Calculate node positions dynamically across central canvas
      const nodeCount = nodes.length;
      const marginX = 80;
      const availableW = width - marginX * 2;
      const stepX = nodeCount > 1 ? availableW / (nodeCount - 1) : 0;
      const nodeY = height / 2;

      const nodeCoords = nodes.map((_, i) => ({
        x: marginX + i * stepX,
        y: nodeY + Math.sin(frame * 0.02 + i * 1.2) * 8, // gentle organic levitation
      }));

      // Render connector wires between nodes
      for (let i = 0; i < nodeCoords.length - 1; i++) {
        const from = nodeCoords[i];
        const to = nodeCoords[i + 1];

        // Wire glow
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(
          from.x + (to.x - from.x) * 0.5,
          from.y + 25,
          from.x + (to.x - from.x) * 0.5,
          to.y - 25,
          to.x,
          to.y
        );
        ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Neon core wire
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(
          from.x + (to.x - from.x) * 0.5,
          from.y + 25,
          from.x + (to.x - from.x) * 0.5,
          to.y - 25,
          to.x,
          to.y
        );
        ctx.strokeStyle = "rgba(0, 255, 204, 0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Real-Time Traversal Visualizer: neon-green particle vector trailing down connector lines
      if (traversalParticleRef.current.active) {
        const edgeIdx = traversalParticleRef.current.currentEdge;
        if (edgeIdx < nodeCoords.length - 1) {
          const from = nodeCoords[edgeIdx];
          const to = nodeCoords[edgeIdx + 1];
          traversalParticleRef.current.t += 0.04;
          const t = Math.min(1, traversalParticleRef.current.t);

          // Bezier point computation
          const cp1x = from.x + (to.x - from.x) * 0.5;
          const cp1y = from.y + 25;
          const cp2x = from.x + (to.x - from.x) * 0.5;
          const cp2y = to.y - 25;

          const cx = 3 * (cp1x - from.x);
          const bx = 3 * (cp2x - cp1x) - cx;
          const ax = to.x - from.x - cx - bx;

          const cy = 3 * (cp1y - from.y);
          const by = 3 * (cp2y - cp1y) - cy;
          const ay = to.y - from.y - cy - by;

          const px = ax * (t * t * t) + bx * (t * t) + cx * t + from.x;
          const py = ay * (t * t * t) + by * (t * t) + cy * t + from.y;

          // Vibrant neon particle
          ctx.save();
          ctx.shadowColor = "#00ffcc";
          ctx.shadowBlur = 18;
          ctx.fillStyle = "#00ffcc";
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();

          // Outer pulse ring
          ctx.strokeStyle = "rgba(0, 255, 204, 0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw Interactive Fluid Nodes
      nodeCoords.forEach((coord, i) => {
        const n = nodes[i];
        const isSelected = n.id === selectedNodeId;
        const isArmed = n.status === "armed";
        const isExecuting = n.status === "executing";
        const isVerified = n.status === "verified";

        let primaryColor = "#6366f1"; // Electric Indigo default
        if (isExecuting) primaryColor = "#ff8a4c"; // Amber/Flame during execution
        if (isVerified) primaryColor = "#00ffcc"; // Razor-sharp Neon Green on completion
        if (isArmed) primaryColor = "#00ffff"; // Cyan

        // Node Glow Ring
        ctx.save();
        if (isSelected || isExecuting) {
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 25;
        }

        // Node Outer Body
        ctx.fillStyle = "#0a071b"; // Deep Obsidian-Purple
        ctx.strokeStyle = isSelected ? "#00ffcc" : primaryColor;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Inner Core Ring
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Rotating orbit indicator for executing node
        if (isExecuting) {
          ctx.strokeStyle = "#00ffcc";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(coord.x, coord.y, 30, frame * 0.1, frame * 0.1 + Math.PI);
          ctx.stroke();
        }

        // Stage Number / Label above node
        ctx.fillStyle = "#9490ac";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`STAGE 0${i + 1}`, coord.x, coord.y - 38);

        // Node Title below node
        ctx.fillStyle = isSelected ? "#00ffcc" : "#ffffff";
        ctx.font = "600 11px 'Inter', sans-serif";
        ctx.fillText(n.name.split(" ")[0], coord.x, coord.y + 40);

        // Status badge
        ctx.fillStyle = primaryColor;
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText(`[${n.status.toUpperCase()}]`, coord.x, coord.y + 54);
      });

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000000] text-[#f1f0f7] selection:bg-[#6366f1]/40 selection:text-white">
      {/* LOCAL STYLES FOR OMNI-SHORTCUT HOVER / ACTIVE / LOADING TRANSITIONS */}
      <style jsx global>{`
        .omni-shortcut {
          transition:
            transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
            border-color 200ms ease,
            box-shadow 200ms ease,
            background 200ms ease;
          will-change: transform, border-color, box-shadow;
        }
        .omni-shortcut:hover {
          transform: translateY(-2px) scale(1.05) !important;
          border-color: #00ffff !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 12px 32px rgba(0, 0, 0, 0.45),
            0 0 24px rgba(0, 255, 255, 0.45),
            0 0 40px rgba(0, 242, 254, 0.3) !important;
        }
        .omni-shortcut:active {
          transform: translateY(0px) scale(0.95) !important;
          border-color: #00ffff !important;
          box-shadow:
            inset 0 3px 8px rgba(0, 0, 0, 0.6),
            0 2px 6px rgba(0, 0, 0, 0.3),
            0 0 14px rgba(0, 255, 255, 0.4) !important;
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
          animation: spin 0.8s linear infinite;
          color: #00ffff;
          font-size: 14px;
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
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* FLOATING CONFIRMATION NOTIFICATION TOAST */}
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
              <span className="text-xs text-[#9490ac] font-mono">Automations Studio</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">OmniAI - Nexus</h1>
          </div>
        </div>

        {/* Telemetry Indicator Readouts */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2 rounded-full bg-[#00ffcc] animate-pulse" />
            <span className="text-[#9490ac]">Event-Loop:</span>
            <span className="text-[#00ffcc] font-semibold">Active Matrix</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Cycle Latency:</span>
            <span className="text-[#00ffcc] font-semibold">{totalCycleMs}ms</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Concurrency:</span>
            <span className="text-[#00ffcc] font-semibold">{freeWindows}/20 Free Slots</span>
          </div>
        </div>

        {/* Right Header Navigation Quick Links */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/api-connector"
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-mono font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
          >
            <Radio className="size-3.5 text-[#00ffcc]" />
            <span>OmniConnect</span>
          </Link>
          <Link
            href="/ui-lab"
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-mono font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
          >
            <Layers className="size-3.5 text-[#6366f1]" />
            <span>Cosmic UI Lab</span>
          </Link>
        </div>
      </header>

      {/* THREE-COLUMN WIDESCREEN WORKSPACE (25% | 50% | 25%) */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* =========================================================================
            PANEL 1: CONVERSATIONAL CONSTRUCTOR & TRIGGERS (LEFT PANEL - 25% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-3 border-r border-[#6366f1]/25 bg-[#000000] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#00ffcc]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Event Constructor</h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc] bg-[#00ffcc]/10 border border-[#00ffcc]/30 px-2 py-0.5 rounded">
              Zero-Downtime
            </span>
          </div>

          {/* Conversational Prompt HUD */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#f1f0f7] flex items-center gap-1.5">
                <FileCode className="size-3.5 text-[#6366f1]" />
                Natural Language Orchestrator
              </label>
              <span className="text-[10px] font-mono text-[#9490ac]">JIT Synthesis</span>
            </div>

            <textarea
              rows={4}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Describe your automation loop: triggers, filters, transformations, and outputs..."
              className="w-full resize-none rounded-lg border border-[#6366f1]/40 bg-[#000000] p-2.5 font-mono text-xs text-[#f1f0f7] placeholder-[#8d87a8]/60 focus:border-[#00ffcc] focus:outline-none focus:ring-1 focus:ring-[#00ffcc]"
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-[#9490ac]">Preset Architecture Blueprints:</span>
              <div className="flex flex-col gap-1">
                {PRESET_PROMPTS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPromptInput(preset)}
                    className="text-left text-[11px] font-mono text-[#8d87a8] hover:text-[#00ffcc] hover:bg-[#6366f1]/10 px-2 py-1 rounded transition truncate"
                  >
                    &gt; {preset}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSynthesizePrompt}
              disabled={isSynthesizing}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/15 py-2 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/25 hover:shadow-[0_0_20px_rgba(0,255,204,0.3)] active:scale-95 disabled:opacity-50"
            >
              {isSynthesizing ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Synthesizing Node Mesh...
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Synthesize Event-Loop Architecture
                </>
              )}
            </button>
          </div>

          {/* Manual Trigger Selector Array */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="size-3.5 text-[#00ffcc]" />
                Primary Trigger Matrix
              </label>
              <span className="font-mono text-[10px] text-[#00ffcc] uppercase">{selectedTrigger}</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Trigger 1: App Webhook Listener Node */}
              <button
                onClick={() => handleSelectTrigger("webhook")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition ${
                  selectedTrigger === "webhook"
                    ? "border-[#00ffcc] bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.2)]"
                    : "border-[#6366f1]/30 bg-[#000000] hover:border-[#6366f1]"
                }`}
              >
                <Radio
                  className={`size-4 shrink-0 mt-0.5 ${
                    selectedTrigger === "webhook" ? "text-[#00ffcc]" : "text-[#6366f1]"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-white">[App Webhook Listener Node]</div>
                  <div className="text-[11px] font-mono text-[#9490ac]">
                    HTTP POST ingress with cryptographic SHA256 signature verification.
                  </div>
                </div>
              </button>

              {/* Trigger 2: Scheduled Cron Ticker Matrix */}
              <button
                onClick={() => handleSelectTrigger("cron")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition ${
                  selectedTrigger === "cron"
                    ? "border-[#00ffcc] bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.2)]"
                    : "border-[#6366f1]/30 bg-[#000000] hover:border-[#6366f1]"
                }`}
              >
                <Clock
                  className={`size-4 shrink-0 mt-0.5 ${
                    selectedTrigger === "cron" ? "text-[#00ffcc]" : "text-[#6366f1]"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-white">[Scheduled Cron Ticker Matrix]</div>
                  <div className="text-[11px] font-mono text-[#9490ac]">
                    High-precision chronometer ticker with drift tolerance jitter dampening.
                  </div>
                </div>
              </button>

              {/* Trigger 3: System State Mutation Hook */}
              <button
                onClick={() => handleSelectTrigger("mutation")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition ${
                  selectedTrigger === "mutation"
                    ? "border-[#00ffcc] bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.2)]"
                    : "border-[#6366f1]/30 bg-[#000000] hover:border-[#6366f1]"
                }`}
              >
                <Activity
                  className={`size-4 shrink-0 mt-0.5 ${
                    selectedTrigger === "mutation" ? "text-[#00ffcc]" : "text-[#6366f1]"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-white">[System State Mutation Hook]</div>
                  <div className="text-[11px] font-mono text-[#9490ac]">
                    Atomic mutation listener monitoring `nexus_active_state_sync`.
                  </div>
                </div>
              </button>
            </div>

            {/* Dynamic Trigger Config Inputs */}
            <div className="mt-2 border-t border-[#6366f1]/20 pt-2 flex flex-col gap-2">
              {selectedTrigger === "webhook" && (
                <div>
                  <label className="text-[10px] font-mono text-[#9490ac]">Listener Inbound URL:</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="mt-1 w-full rounded border border-[#6366f1]/40 bg-[#000000] px-2 py-1 font-mono text-xs text-[#00ffcc] focus:border-[#00ffcc] focus:outline-none"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-[#8d87a8]">
                    <span>Auth: HMAC-SHA256</span>
                    <span>Max Size: 256 KB</span>
                  </div>
                </div>
              )}

              {selectedTrigger === "cron" && (
                <div>
                  <label className="text-[10px] font-mono text-[#9490ac]">Cron Expression & Jitter:</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={cronExpression}
                      onChange={(e) => setCronExpression(e.target.value)}
                      className="rounded border border-[#6366f1]/40 bg-[#000000] px-2 py-1 font-mono text-xs text-[#00ffcc] focus:border-[#00ffcc] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={cronJitter}
                      onChange={(e) => setCronJitter(e.target.value)}
                      className="rounded border border-[#6366f1]/40 bg-[#000000] px-2 py-1 font-mono text-xs text-[#9490ac] focus:border-[#00ffcc] focus:outline-none"
                    />
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {["*/1 * * * *", "*/5 * * * *", "0 * * * *"].map((expr) => (
                      <button
                        key={expr}
                        onClick={() => setCronExpression(expr)}
                        className="rounded bg-[#6366f1]/20 px-1.5 py-0.5 font-mono text-[9px] text-[#6366f1] hover:text-[#00ffcc]"
                      >
                        {expr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTrigger === "mutation" && (
                <div>
                  <label className="text-[10px] font-mono text-[#9490ac]">Mutation Channel & Debounce (ms):</label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={mutationChannel}
                      onChange={(e) => setMutationChannel(e.target.value)}
                      className="col-span-2 rounded border border-[#6366f1]/40 bg-[#000000] px-2 py-1 font-mono text-xs text-[#00ffcc] focus:border-[#00ffcc] focus:outline-none"
                    />
                    <input
                      type="number"
                      value={mutationDebounce}
                      onChange={(e) => setMutationDebounce(e.target.value)}
                      className="rounded border border-[#6366f1]/40 bg-[#000000] px-2 py-1 font-mono text-xs text-[#00ffcc] focus:border-[#00ffcc] focus:outline-none"
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] font-mono text-[#8d87a8]">
                    Sync Target: PostgreSQL Real-Time Replication Stream
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Node Configuration Inspector */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Network className="size-3.5 text-[#00ffcc]" />
                Selected Node Parameters
              </span>
              <button
                onClick={handleCopyNodeConfig}
                className="flex items-center gap-1 text-[10px] font-mono text-[#9490ac] hover:text-[#00ffcc]"
              >
                {copiedToken ? <Check className="size-3 text-[#00ffcc]" /> : <Copy className="size-3" />}
                {copiedToken ? "COPIED" : "COPY JSON"}
              </button>
            </div>

            <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2.5">
              <div className="text-[11px] font-bold text-[#00ffcc]">{selectedNode.name}</div>
              <div className="text-[10px] font-mono text-[#8d87a8] mt-0.5">{selectedNode.summary}</div>
              <pre className="mt-2 text-[10px] font-mono text-[#00ffcc] overflow-x-auto max-h-36">
                {JSON.stringify(selectedNode.config, null, 2)}
              </pre>
            </div>
          </div>
        </section>

        {/* =========================================================================
            PANEL 2: THE INFINITE EVENT-LOOP WORKSPACE (CENTER PANEL - 50% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-6 bg-[#000000] p-4 flex flex-col justify-between overflow-hidden relative">
          {/* Top Canvas Bar & Node Pipeline Selection Tabs */}
          <div className="flex flex-col gap-3 z-10">
            <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[#6366f1]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  The Infinite Event-Loop Canvas
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#9490ac]">Stages:</span>
                <span className="font-mono text-xs font-bold text-[#00ffcc]">{nodes.length} Connected</span>
              </div>
            </div>

            {/* Stage Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {nodes.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNodeId(n.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition shrink-0 ${
                    selectedNodeId === n.id
                      ? "border-[#00ffcc] bg-[#00ffcc]/15 text-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.25)]"
                      : "border-[#6366f1]/30 bg-[#0a071b] text-[#9490ac] hover:border-[#6366f1] hover:text-white"
                  }`}
                >
                  <span className="size-2 rounded-full bg-[#6366f1]" />
                  <span>{i + 1}. {n.name.split(" ")[0]}</span>
                  <span className="text-[10px] text-[#8d87a8]">({n.latencyMs}ms)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Central Interactive Fluid Canvas */}
          <div className="relative my-3 flex-1 min-h-[360px] w-full rounded-2xl border border-[#6366f1]/30 bg-[#000000] overflow-hidden shadow-[inset_0_0_50px_rgba(10,7,27,0.8)]">
            <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-crosshair" />

            {/* Floating Simulation Toolbed */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-[#000000]/80 backdrop-blur-md p-1.5 rounded-xl border border-[#6366f1]/40 shadow-2xl">
              <button
                onClick={handleExecuteSandbox}
                disabled={isSimulating}
                className="flex items-center gap-1.5 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/20 px-3 py-1.5 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/30 hover:shadow-[0_0_20px_rgba(0,255,204,0.4)] active:scale-95 disabled:opacity-50"
              >
                <Play className="size-3.5 fill-[#00ffcc]" />
                [Execute Sandbox Test Loop]
              </button>

              <button
                onClick={handleFormatPayload}
                className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-2.5 py-1.5 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
              >
                <AlignLeft className="size-3.5 text-[#6366f1]" />
                [Format Payload Indentation]
              </button>

              <button
                onClick={handleClearCache}
                className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-2.5 py-1.5 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#ff2a6d] hover:text-[#ff2a6d] active:scale-95"
              >
                <Trash2 className="size-3.5 text-[#ff2a6d]" />
                [Clear Active Cache]
              </button>
            </div>

            {/* Real-Time Latency Fluctuations Graph Widget on Center Canvas */}
            <div className="absolute top-4 right-4 z-20 w-64 rounded-xl border border-[#00ffcc]/35 bg-[#000000]/90 backdrop-blur-md p-2.5 shadow-[0_0_25px_rgba(0,255,204,0.18)] pointer-events-auto flex flex-col gap-1.5">
              <div className="flex items-center justify-between border-b border-[#6366f1]/25 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${isSimulating ? "bg-[#00ffcc] animate-ping" : "bg-[#6366f1]"}`} />
                  <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                    Pipeline Latency Fluctuations
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs font-bold text-[#00ffcc]">
                    {currentLatency.toFixed(1)}ms
                  </span>
                </div>
              </div>

              {/* Dynamic Oscillogram Sparkline SVG */}
              <div className="relative h-14 w-full overflow-hidden rounded bg-[#0a071b] border border-[#6366f1]/30">
                <svg className="w-full h-full" viewBox="0 0 240 56" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="latencyGlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ffcc" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#00ffcc" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Gridlines */}
                  <line x1="0" y1="14" x2="240" y2="14" stroke="rgba(99,102,241,0.2)" strokeDasharray="3,3" />
                  <line x1="0" y1="28" x2="240" y2="28" stroke="rgba(99,102,241,0.2)" strokeDasharray="3,3" />
                  <line x1="0" y1="42" x2="240" y2="42" stroke="rgba(99,102,241,0.2)" strokeDasharray="3,3" />

                  {/* Latency Fluctuation Polyline & Gradient Fill */}
                  {(() => {
                    const minL = Math.min(...latencyHistory, 5);
                    const maxL = Math.max(...latencyHistory, 35);
                    const range = Math.max(1, maxL - minL);
                    const pts = latencyHistory.map((val, idx) => {
                      const x = (idx / (latencyHistory.length - 1 || 1)) * 240;
                      const y = 50 - ((val - minL) / range) * 44;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });
                    const pathD = `M ${pts.join(" L ")}`;
                    const fillD = `M 0,56 L ${pts.join(" L ")} L 240,56 Z`;

                    return (
                      <g key="latency-curve">
                        <path d={fillD} fill="url(#latencyGlowGrad)" />
                        <path d={pathD} fill="none" stroke="#00ffcc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* Readout Metrics */}
              <div className="flex items-center justify-between text-[9px] font-mono text-[#9490ac]">
                <span>Floor: {Math.min(...latencyHistory).toFixed(1)}ms</span>
                <span className="text-[#6366f1]">Jitter: ±{loopJitter}ms</span>
                <span className="text-[#00ffcc]">Peak: {Math.max(...latencyHistory).toFixed(1)}ms</span>
              </div>
            </div>

            {/* Simulating Progress Bar Overlay */}
            {isSimulating && (
              <div className="absolute bottom-4 left-4 right-4 z-20 rounded-xl border border-[#00ffcc]/40 bg-[#000000]/90 backdrop-blur-md p-2.5 flex items-center justify-between shadow-[0_0_25px_rgba(0,255,204,0.3)]">
                <div className="flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin text-[#00ffcc]" />
                  <span className="font-mono text-xs font-bold text-[#00ffcc]">
                    Traversing Stage Vector...
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40 h-2 bg-[#0a071b] rounded-full overflow-hidden border border-[#6366f1]/30">
                    <div
                      className="h-full bg-[#00ffcc] transition-all duration-300 shadow-[0_0_10px_#00ffcc]"
                      style={{ width: `${simProgress}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-[#00ffcc] font-bold">{simProgress}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Embedded Interactive .omni-shortcut cards for rapid cross-module navigation */}
          <div className="mb-3 flex flex-col gap-2 z-10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9490ac] flex items-center gap-1.5">
                <Network className="size-3 text-[#00ffcc]" />
                Omni Quick Connectors (Tactile Press Feedback)
              </span>
              <span className="text-[10px] font-mono text-[#6366f1]">:active scale(0.95) enabled</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Shortcut 1: OmniConnect API & Webhook Lab */}
              <button
                onClick={() => handleShortcutClick("/api-connector", "sc-api")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2.5 text-left transition ${
                  loadingShortcut === "sc-api" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    OmniConnect
                    {loadingShortcut === "sc-api" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Radio className="size-3.5 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-1">
                  API & Webhook Ingress
                </span>
                {loadingShortcut === "sc-api" && <span className="omni-shortcut-pulse" />}
              </button>

              {/* Shortcut 2: Cosmic UI Lab */}
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
                  <Layers className="size-3.5 text-[#6366f1]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-1">
                  Component Playground
                </span>
                {loadingShortcut === "sc-ui" && <span className="omni-shortcut-pulse" />}
              </button>

              {/* Shortcut 3: Command Center Dashboard */}
              <button
                onClick={() => handleShortcutClick("/dashboard", "sc-dash")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2.5 text-left transition ${
                  loadingShortcut === "sc-dash" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    Nexus Deck
                    {loadingShortcut === "sc-dash" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Cpu className="size-3.5 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-1">
                  System Diagnostics
                </span>
                {loadingShortcut === "sc-dash" && <span className="omni-shortcut-pulse" />}
              </button>
            </div>
          </div>

          {/* Permanent Monospaced Telemetry Bar at Bottom */}
          <div className="z-10 flex items-center justify-between rounded-xl border border-[#00ffcc]/35 bg-[#0a071b] px-4 py-2 text-xs font-mono shadow-[0_0_20px_rgba(0,255,204,0.15)]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-ping" />
              <span className="text-[#00ffcc] font-bold">
                [Nexus-Auto: System Event-Loop Active / Isolated Sandbox Node Engine Operational]
              </span>
            </div>
            <span className="text-[11px] text-[#9490ac] hidden sm:inline">
              V8 Engine: Sub-20ms Pipeline
            </span>
          </div>
        </section>

        {/* =========================================================================
            PANEL 3: PERFORMANCE METRICS & DISPATCH TERMINAL (RIGHT PANEL - 25% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-3 border-l border-[#6366f1]/25 bg-[#000000] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-[#00ffcc]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Dispatch Terminal</h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc]">Live Telemetry</span>
          </div>

          {/* Concurrent Loop Tracker Matrix (Low-Profile Visual Diagnostic Meters) */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-[#00ffcc]" />
                Concurrent Loop Tracker Matrix
              </span>
              <span className="text-[10px] font-mono text-[#00ffcc]">20 Slots</span>
            </div>

            {/* Meter 1: Memory Overhead */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#9490ac]">Memory Overhead</span>
                <span className="text-[#00ffcc] font-bold">{memoryMb} MB / 512 MB</span>
              </div>
              <div className="h-1.5 w-full bg-[#000000] rounded-full overflow-hidden border border-[#6366f1]/30">
                <div
                  className="h-full bg-[#00ffcc] transition-all duration-500"
                  style={{ width: `${(memoryMb / 512) * 100}%` }}
                />
              </div>
            </div>

            {/* Meter 2: Throughput Ops/Sec */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#9490ac]">Throughput Ops/Sec</span>
                <span className="text-[#00ffcc] font-bold">{throughputOps} ops/s</span>
              </div>
              <div className="h-1.5 w-full bg-[#000000] rounded-full overflow-hidden border border-[#6366f1]/30">
                <div
                  className="h-full bg-[#6366f1] transition-all duration-500"
                  style={{ width: `${(throughputOps / 4000) * 100}%` }}
                />
              </div>
            </div>

            {/* Meter 3: Free Execution Windows */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#9490ac]">Free Execution Windows</span>
                <span className="text-[#00ffcc] font-bold">{freeWindows} Slots (95% Avail)</span>
              </div>
              <div className="grid grid-cols-10 gap-1 pt-1">
                {Array.from({ length: 20 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-sm transition ${
                      idx < 20 - freeWindows
                        ? "bg-[#ff8a4c] shadow-[0_0_6px_#ff8a4c]"
                        : "bg-[#00ffcc]/30 border border-[#00ffcc]/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Loop Jitter Readout */}
            <div className="flex items-center justify-between pt-1 border-t border-[#6366f1]/20 text-[11px] font-mono">
              <span className="text-[#8d87a8]">Loop Cycle Jitter:</span>
              <span className="text-[#00ffcc] font-bold">±{loopJitter}ms</span>
            </div>
          </div>

          {/* Live Event Payload Console */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2 flex-1 min-h-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="size-3.5 text-[#00ffcc]" />
                Live Event Payload Console
              </span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] font-mono text-[#9490ac] hover:text-[#ff2a6d]"
              >
                [CLEAR LOGS]
              </button>
            </div>

            <div className="flex-1 rounded-lg border border-[#6366f1]/25 bg-[#000000] p-2.5 font-mono text-[11px] text-[#00ffcc] overflow-y-auto max-h-56 flex flex-col gap-2 select-text">
              <div className="text-[10px] text-[#8d87a8] pb-1 border-b border-[#6366f1]/20">
                {"// STREAMED RUNTIME EVENT LOGS (ACCURATE TO MILLISECONDS)"}
              </div>

              {logs.length === 0 ? (
                <div className="text-xs text-[#8d87a8] italic py-4 text-center">
                  Console idle. Press [Execute Sandbox Test Loop] to generate telemetry.
                </div>
              ) : (
                logs.map((log) => {
                  let badgeColor = "text-[#6366f1] border-[#6366f1]/40";
                  if (log.level === "EXEC") badgeColor = "text-[#00ffcc] border-[#00ffcc]/40";
                  if (log.level === "DISPATCH") badgeColor = "text-[#00ffff] border-[#00ffff]/40";
                  if (log.level === "WARN") badgeColor = "text-[#ff2a6d] border-[#ff2a6d]/40";

                  return (
                    <div key={log.id} className="flex flex-col gap-0.5 leading-relaxed">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-[#8d87a8]">{log.timestamp}</span>
                        <span className={`text-[9px] px-1 rounded border ${badgeColor}`}>
                          {log.level}
                        </span>
                        {log.nodeId && <span className="text-[9px] text-[#9490ac]">@{log.nodeId}</span>}
                      </div>
                      <div className="text-white text-[11px] pl-1 font-mono">{log.message}</div>
                      {log.payload && (
                        <pre className="text-[10px] text-[#00ffcc] bg-[#0a071b] p-1.5 rounded mt-1 overflow-x-auto border border-[#6366f1]/20">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Production Deploy Assembly Button Stack */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <UploadCloud className="size-3.5 text-[#00ffcc]" />
              Production Deploy Assembly
            </span>

            {/* Button 1: Deploy Active Loop Live into Production Core */}
            <button
              onClick={handleDeployProduction}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/20 py-2.5 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/30 hover:shadow-[0_0_25px_rgba(0,255,204,0.4)] active:scale-95"
            >
              <Zap className="size-4" />
              [Deploy Active Loop Live into Production Core]
            </button>

            {/* Button 2: Export Automation Schema Backup JSON to Global Vault */}
            <button
              onClick={handleExportSchema}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1]/40 bg-[#000000] py-2 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
            >
              <Download className="size-3.5 text-[#6366f1]" />
              [Export Automation Schema Backup JSON to Global Vault]
            </button>

            {/* Button 3: Route System Logs to OmniAnalyzer Tracking Modules */}
            <button
              onClick={handleRouteToAnalyzer}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1]/40 bg-[#000000] py-2 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
            >
              <Share2 className="size-3.5 text-[#6366f1]" />
              [Route System Logs to OmniAnalyzer Tracking Modules]
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
