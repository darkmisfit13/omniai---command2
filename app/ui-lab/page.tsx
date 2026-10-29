"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import HoloOrb from "@/components/HoloOrb";
import {
  Sliders,
  Terminal as TerminalIcon,
  Copy,
  Download,
  Send,
  RefreshCw,
  Eye,
  Monitor,
  Smartphone,
  Check,
  Code,
  Layers,
  Sparkles,
  Zap,
  Activity,
  ArrowUpRight,
  Shield,
  Radio,
} from "lucide-react";

type Framework = "react" | "vue" | "webgl";
type InteractiveState = "default" | "hover" | "active" | "streaming";

interface DomNode {
  id: string;
  name: string;
  tag: string;
  children?: DomNode[];
}

const DOM_HIERARCHY: DomNode[] = [
  {
    id: "root-card",
    name: "RootContainer.Card",
    tag: "<section.nexus-card>",
    children: [
      {
        id: "header-telemetry",
        name: "Header.TelemetryNode",
        tag: "<header.telemetry-beacon>",
      },
      {
        id: "body-glass",
        name: "Body.GlassPanel",
        tag: "<div.glass-surface>",
        children: [
          {
            id: "metrics-stream",
            name: "Metrics.NeonDataBar",
            tag: "<div.vector-databar>",
          },
          {
            id: "shortcut-interactive",
            name: "Shortcut.OmniInteractive",
            tag: "<div.omni-shortcut>",
          },
        ],
      },
      {
        id: "footer-action",
        name: "Footer.ActionButton",
        tag: "<footer.action-cluster>",
      },
    ],
  },
];

export default function CosmicUILabPage() {
  // Conversational Generator State
  const [prompt, setPrompt] = useState(
    "Responsive telemetry analytics card, sharp glassmorphic edges, purplish-blue micro-borders with neon-green streaming data bars"
  );
  const [framework, setFramework] = useState<Framework>("react");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileTimestamp, setCompileTimestamp] = useState(Date.now());

  // Vector Frame Modifiers (Sliders)
  const [blurDepth, setBlurDepth] = useState(18); // 0 - 48 px
  const [cornerSharpness, setCornerSharpness] = useState(14); // 0 - 32 px
  const [glowPulseVelocity, setGlowPulseVelocity] = useState(1.2); // 0.1s - 3.0s
  const [borderStrokeWeight, setBorderStrokeWeight] = useState(1.2); // 0.5 - 4.0 px

  // Floating Interactive Modifier Deck States
  const [simulatedState, setSimulatedState] = useState<InteractiveState>("default");
  const [invertedBrandColor, setInvertedBrandColor] = useState(false);

  // Inspector & Output States
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [exportedCursor, setExportedCursor] = useState(false);
  const [pushedStaging, setPushedStaging] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);

  // Quick Prompts Preset HUD
  const PRESET_PROMPTS = [
    "Responsive telemetry analytics card, sharp glassmorphic edges, purplish-blue micro-borders with neon-green streaming data bars",
    "Quantum neural HUD switch card with glowing frequency wave and purplish-blue bevels",
    "Cyberpunk biometric sensor tile with razor-sharp corners and high-density vector readouts",
    "Widescreen orbital compute node with deep obsidian shadow depth and active shortcut triggers",
  ];

  // Compilation Logs Stream
  const [logs, setLogs] = useState<string[]>([
    "[00:00:01] [NEXUS-UI // INIT] WebGPU Component Compiler initialized on port 3000",
    "[00:00:01] [TOKENS // MOUNT] Unified Tailwind v4 design tokens verified: Canvas #000000 | Container #0a071b",
    "[00:00:02] [PARSING DESIGN TOKENS...] Purplish-Blue (#6366f1) & Neon Green (#00ffcc) bound to shader engine",
    "[00:00:02] [COMPILING TSX NODE BUILD...] Zero-runtime registry ready <0.8ms",
  ]);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal logs
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Re-Scaffold action
  function handleReScaffold() {
    setIsCompiling(true);
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      `[${ts}] [CLEAN_RE_SCAFFOLD] Invalidating existing AST caches...`,
      `[${ts}] [PARSING DESIGN TOKENS...] Extracting geometry vectors: blur=${blurDepth}px, radius=${cornerSharpness}px`,
      `[${ts}] [OPTIMIZING CSS COMBINATIONS...] Enforcing Obsidian Cyberpunk tokens`,
      `[${ts}] [COMPILING ${framework.toUpperCase()} NODE BUILD...] JIT hot-reloader synced in 0.0016s`,
    ]);

    setTimeout(() => {
      setIsCompiling(false);
      setCompileTimestamp(Date.now());
    }, 280);
  }

  // Toggle Interactive Event States
  function cycleInteractiveState() {
    const states: InteractiveState[] = ["default", "hover", "active", "streaming"];
    const nextIdx = (states.indexOf(simulatedState) + 1) % states.length;
    setSimulatedState(states[nextIdx]);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [EVENT_SIMULATION] Shifted state to: [${states[nextIdx].toUpperCase()}]`,
    ]);
  }

  // Invert Brand Color Distribution
  function toggleBrandInvert() {
    setInvertedBrandColor((prev) => !prev);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [PALETTE_INVERSION] Active highlight inverted: ${
        !invertedBrandColor ? "Vibrant Neon Green #00ffcc" : "Purplish-Blue #6366f1"
      }`,
    ]);
  }

  // Generated Production Component Code
  const generatedCode = useMemo(() => {
    const primaryColor = invertedBrandColor ? "#00ffcc" : "#6366f1";
    const accentColor = invertedBrandColor ? "#6366f1" : "#00ffcc";

    if (framework === "react") {
      return `// OmniAI - Nexus // Dark Misfit Studios
// Target: React 18+ & Tailwind v4 Unified Registry
import React, { useState } from 'react';
import { Activity, ArrowUpRight, Zap, Radio } from 'lucide-react';

export interface NexusTelemetryCardProps {
  title?: string;
  telemetryStream?: number[];
  status?: 'nominal' | 'elevated' | 'critical';
  onAction?: () => void;
}

export default function NexusTelemetryCard({
  title = "${prompt.slice(0, 36)}...",
  status = "nominal",
  onAction,
}: NexusTelemetryCardProps) {
  const [active, setActive] = useState(false);

  return (
    <section 
      className="relative w-full overflow-hidden border border-[#6366f1]/40 bg-[#0a071b] text-[#e0def4] transition-all duration-300"
      style={{
        borderRadius: '${cornerSharpness}px',
        borderWidth: '${borderStrokeWeight}px',
        backdropFilter: 'blur(${blurDepth}px)',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.8), 0 0 24px -4px ${primaryColor}33',
      }}
    >
      {/* Top Laser Accent */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, ${primaryColor}, ${accentColor}, transparent)',
          animation: 'pulse ${glowPulseVelocity}s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />

      {/* Header Beacon */}
      <header className="flex items-center justify-between border-b border-[#6366f1]/20 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ffcc] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00ffcc]" />
          </span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#00ffcc]">
            NEXUS // REALTIME TELEMETRY
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#9490ac]">ID-904 // ULTRA</span>
      </header>

      {/* Body Surface */}
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold text-white sm:text-lg">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#9490ac]">
            Glassmorphic spatial depth with isolated runtime memory pipes.
          </p>
        </div>

        {/* Vector Data Streaming Bars */}
        <div className="space-y-2 rounded-lg border border-[#6366f1]/15 bg-[#000000]/40 p-3">
          <div className="flex items-center justify-between font-mono text-[11px] text-[#00ffcc]">
            <span>SPECTRAL LOAD</span>
            <span>98.42% NOMINAL</span>
          </div>
          <div className="flex h-2 w-full gap-1 overflow-hidden rounded bg-[#0a071b]">
            {[45, 80, 60, 92, 75, 88, 95].map((val, i) => (
              <div 
                key={i} 
                className="h-full flex-1 rounded-sm transition-all"
                style={{ 
                  background: val > 85 ? '#00ffcc' : '${primaryColor}',
                  opacity: val / 100 
                }} 
              />
            ))}
          </div>
        </div>

        {/* Physical Press Shortcut */}
        <div className="omni-shortcut cursor-pointer p-3.5 rounded-xl border border-[#a78bfa]/20 bg-gradient-to-br from-[#181224]/85 to-[#0a0910]/95">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-white">Execute Quantum Pass</span>
            <ArrowUpRight className="size-4 text-[#00ffcc]" />
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <footer className="border-t border-[#6366f1]/20 bg-[#000000]/30 px-5 py-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-[#9490ac]">LATENCY: &lt;0.002s</span>
        <button
          onClick={onAction}
          className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-black transition-all hover:brightness-110 active:scale-95"
          style={{ background: '${accentColor}' }}
        >
          Dispatch Pipeline
        </button>
      </footer>
    </section>
  );
}`;
    }

    if (framework === "vue") {
      return `<!-- OmniAI - Nexus // Vue 3 Production Component -->
<template>
  <section 
    class="nexus-card"
    :style="{
      borderRadius: '${cornerSharpness}px',
      borderWidth: '${borderStrokeWeight}px',
      backdropFilter: 'blur(${blurDepth}px)',
      boxShadow: '0 16px 40px -10px rgba(0,0,0,0.8), 0 0 24px -4px ${primaryColor}33'
    }"
  >
    <div class="laser-accent" />
    <header class="card-header">
      <div class="beacon-wrap">
        <span class="beacon-dot" />
        <span class="beacon-text">NEXUS // REALTIME TELEMETRY</span>
      </div>
      <span class="metric-tag">ID-904 // ULTRA</span>
    </header>

    <div class="card-body">
      <h2 class="title">{{ title }}</h2>
      <p class="desc">{{ description }}</p>

      <div class="omni-shortcut" @click="emit('action')">
        <span>Execute Quantum Pass</span>
      </div>
    </div>

    <footer class="card-footer">
      <span class="latency">LATENCY: &lt;0.002s</span>
      <button class="dispatch-btn" @click="emit('dispatch')">Dispatch Pipeline</button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = withDefaults(defineProps<{
  title?: string;
  description?: string;
}>(), {
  title: "${prompt.slice(0, 36)}...",
  description: "Glassmorphic spatial depth with isolated runtime memory pipes."
});

const emit = defineEmits(['action', 'dispatch']);
</script>

<style scoped>
.nexus-card {
  position: relative;
  overflow: hidden;
  border-style: solid;
  border-color: rgba(99, 102, 241, 0.4);
  background-color: #0a071b;
  color: #e0def4;
}
.laser-accent {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, ${primaryColor}, ${accentColor}, transparent);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(99, 102, 241, 0.2);
  padding: 14px 20px;
}
.beacon-text { font-family: monospace; font-size: 11px; color: #00ffcc; font-weight: 600; }
.card-body { padding: 20px; }
.title { font-size: 18px; font-weight: 700; color: #ffffff; }
.desc { font-size: 12px; color: #9490ac; margin-top: 4px; }
.omni-shortcut {
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  background: linear-gradient(145deg, rgba(28, 20, 48, 0.96), rgba(12, 10, 22, 0.98));
  cursor: pointer;
  transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
}
.omni-shortcut:hover {
  transform: translateY(-2px) scale(1.05);
  border-color: #00ffff;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);
}
.omni-shortcut:active {
  transform: translateY(0px) scale(0.95);
  border-color: #00ffff;
}
.dispatch-btn {
  background: ${accentColor};
  color: #000000;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
</style>`;
    }

    // Raw WebGL / HTML5 Canvas
    return `<!-- OmniAI - Nexus // Raw WebGL Shader + HTML5 Canvas Component -->
<canvas id="nexus-gl-canvas" width="600" height="400" style="background: #000000; border-radius: ${cornerSharpness}px; border: ${borderStrokeWeight}px solid ${primaryColor}; box-shadow: 0 0 32px ${primaryColor}44;"></canvas>

<script>
(function() {
  const canvas = document.getElementById('nexus-gl-canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return console.error('WebGL unavailable');

  // Fragment Shader with Obsidian Cyberpunk Glow
  const fsSource = \`
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution;
      float d = length(st - 0.5);
      vec3 obsidian = vec3(0.039, 0.027, 0.106); // #0a071b
      vec3 indigo = vec3(0.388, 0.4, 0.945);    // #6366f1
      vec3 neon = vec3(0.0, 1.0, 0.8);          // #00ffcc
      
      float wave = sin(st.x * 24.0 + u_time * ${glowPulseVelocity}) * 0.5 + 0.5;
      vec3 color = mix(obsidian, indigo, smoothstep(0.4, 0.1, d));
      if (st.y < 0.15 && abs(st.x - 0.5) < 0.4) {
        color = mix(color, neon, wave * 0.8);
      }
      gl_FragColor = vec4(color, 1.0);
    }
  \`;
  // WebGPU / WebGL compilation pipeline
  console.log('[Nexus-UI: WebGPU Component Compiler Active]');
})();
</script>`;
  }, [
    prompt,
    framework,
    blurDepth,
    cornerSharpness,
    glowPulseVelocity,
    borderStrokeWeight,
    invertedBrandColor,
  ]);

  // Copy Clean Code Handler
  function handleCopyCode() {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [CLIPBOARD] Clean production ${framework.toUpperCase()} code copied to clipboard`,
    ]);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  // Export to Cursor Project Directory
  function handleExportCursor() {
    setExportedCursor(true);
    const ext = framework === "react" ? "tsx" : framework === "vue" ? "vue" : "html";
    const filename = `NexusComponent_${Date.now()}.${ext}`;
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [CURSOR_DISPATCH] Component package exported to cursor project as ${filename}`,
    ]);
    setTimeout(() => setExportedCursor(false), 2200);
  }

  // Push to Omni Video / Storyboard Staging Bays
  function handlePushStaging() {
    setPushedStaging(true);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [STAGING_BAY] Layout component pushed to Omni Video / Storyboard Staging Bays`,
      `[${new Date().toLocaleTimeString()}] [STAGING_BAY] WebGL shader vector matrices synced with frame rate sequencer`,
    ]);
    setTimeout(() => setPushedStaging(false), 2200);
  }

  // Dynamic colors based on inversion toggle
  const primaryThemeColor = invertedBrandColor ? "#00ffcc" : "#6366f1";
  const accentThemeColor = invertedBrandColor ? "#6366f1" : "#00ffcc";

  return (
    <div className="cosmic-ui-lab min-h-screen w-full bg-[#000000] text-[#e0def4] flex flex-col font-sans select-none">
      {/* Global Embedded Styles for Obsidian Cyberpunk Tokens & .omni-shortcut */}
      <style jsx global>{`
        .cosmic-ui-lab input[type="range"] {
          -webkit-appearance: none;
          background: #141029;
          height: 6px;
          border-radius: 9999px;
          outline: none;
        }
        .cosmic-ui-lab input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid #00ffcc;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0, 255, 204, 0.6);
          transition: transform 150ms ease, box-shadow 150ms ease;
        }
        .cosmic-ui-lab input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 14px rgba(0, 255, 204, 0.9);
        }

        /* Physical Hover & Active Sensation for .omni-shortcut */
        .omni-shortcut {
          user-select: none;
          cursor: pointer;
          transition:
            transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
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

        /* Pulsing data stream simulation */
        @keyframes cyberStream {
          0% { opacity: 0.3; transform: scaleY(0.7); }
          50% { opacity: 1; transform: scaleY(1); }
          100% { opacity: 0.3; transform: scaleY(0.7); }
        }
        .animate-cyber-stream {
          animation: cyberStream 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* UNIVERSAL APPLICATION HEADER */}
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#6366f1]/25 bg-[#000000]/90 px-5 backdrop-blur-md">
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
              <span className="text-xs text-[#9490ac] font-mono">Cosmic UI Lab</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
              OmniAI - Nexus
            </h1>
          </div>
        </div>

        {/* Global Design Tokens Readout */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2.5 rounded-full bg-[#000000] border border-white/40" />
            <span className="text-[#9490ac]">Canvas:</span>
            <span className="text-[#00ffcc] font-semibold">#000000</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2.5 rounded-full bg-[#0a071b] border border-[#6366f1]/60" />
            <span className="text-[#9490ac]">Blocks:</span>
            <span className="text-[#00ffcc] font-semibold">#0a071b</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2.5 rounded-full bg-[#6366f1]" />
            <span className="text-[#9490ac]">Highlights:</span>
            <span className="text-[#00ffcc] font-semibold">#6366f1</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2.5 rounded-full bg-[#00ffcc] shadow-[0_0_8px_#00ffcc]" />
            <span className="text-[#9490ac]">Telemetry:</span>
            <span className="text-[#00ffcc] font-semibold">#00ffcc</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCodeModal((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-medium text-[#d8d3ef] transition hover:border-[#6366f1] hover:text-white"
          >
            <Code className="size-3.5 text-[#00ffcc]" />
            <span>Raw Output</span>
          </button>

          <button
            onClick={handleReScaffold}
            disabled={isCompiling}
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1] bg-[#6366f1] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isCompiling ? "animate-spin" : ""}`} />
            <span>Compile AST</span>
          </button>
        </div>
      </header>

      {/* THREE-COLUMN WIDESCREEN WORKSPACE (25% | 50% | 25%) */}
      <main className="grid w-full flex-1 grid-cols-1 xl:grid-cols-12 gap-4 p-4 min-h-[calc(100vh-64px-36px)]">
        
        {/* ======================================================== */}
        {/* PANEL 1: CONVERSATIONAL GENERATOR & TOKENS (LEFT - 25%) */}
        {/* ======================================================== */}
        <section className="xl:col-span-3 flex flex-col gap-4 rounded-2xl border border-[#6366f1]/25 bg-[#0a071b] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#00ffcc]" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Generative Intake HUD
              </h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc]">PANEL 01 // INTAKE</span>
          </div>

          {/* Generative Component Intake HUD */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#9490ac] flex items-center justify-between">
              <span>NATURAL LANGUAGE BLUEPRINT</span>
              <span className="font-mono text-[10px] text-[#6366f1]">ZERO-DOWNTIME</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe your futuristic sci-fi layout..."
              className="w-full resize-none rounded-xl border border-[#6366f1]/30 bg-[#000000]/60 p-3 text-xs leading-relaxed text-white placeholder-[#504a70] outline-none transition focus:border-[#6366f1] focus:shadow-[0_0_12px_rgba(99,102,241,0.3)]"
            />

            {/* Preset Blueprint Chips */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[11px] font-mono text-[#9490ac]">PRESET ARCHITECTURES:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(p);
                      handleReScaffold();
                    }}
                    className="text-left rounded-md border border-[#6366f1]/25 bg-[#000000]/40 px-2 py-1 text-[11px] text-[#c4b5fd] transition hover:border-[#00ffcc] hover:text-white"
                  >
                    {idx === 0
                      ? "Telemetry Analytics Card"
                      : idx === 1
                      ? "Quantum HUD Switch"
                      : idx === 2
                      ? "Biometric Sensor Tile"
                      : "Orbital Compute Node"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* UI Framework Selection Deck */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#6366f1]/20">
            <label className="text-xs font-semibold text-[#9490ac]">
              COMPILATION TARGET FRAMEWORK
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-1">
              <button
                onClick={() => setFramework("react")}
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-center transition-all ${
                  framework === "react"
                    ? "border border-[#6366f1] bg-[#6366f1]/25 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                    : "text-[#9490ac] hover:text-white"
                }`}
              >
                <span className="text-[11px] font-bold">React</span>
                <span className="text-[9px] font-mono text-[#00ffcc]">Tailwind v4</span>
              </button>

              <button
                onClick={() => setFramework("vue")}
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-center transition-all ${
                  framework === "vue"
                    ? "border border-[#6366f1] bg-[#6366f1]/25 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                    : "text-[#9490ac] hover:text-white"
                }`}
              >
                <span className="text-[11px] font-bold">Vue 3</span>
                <span className="text-[9px] font-mono text-[#00ffcc]">SFC Module</span>
              </button>

              <button
                onClick={() => setFramework("webgl")}
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-center transition-all ${
                  framework === "webgl"
                    ? "border border-[#6366f1] bg-[#6366f1]/25 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                    : "text-[#9490ac] hover:text-white"
                }`}
              >
                <span className="text-[11px] font-bold">Raw WebGL</span>
                <span className="text-[9px] font-mono text-[#00ffcc]">HTML5 Canvas</span>
              </button>
            </div>
          </div>

          {/* Vector Frame Modifiers (Sliders) */}
          <div className="flex flex-col gap-3 pt-2 border-t border-[#6366f1]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders className="size-3.5 text-[#6366f1]" />
                <label className="text-xs font-semibold text-white">
                  Vector Frame Modifiers
                </label>
              </div>
              <span className="font-mono text-[10px] text-[#00ffcc]">LIVE GEOMETRY</span>
            </div>

            {/* Slider 1: Blur Depth */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#9490ac]">Glassmorphic Blur Depth</span>
                <span className="text-[#00ffcc] font-bold">{blurDepth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="48"
                step="1"
                value={blurDepth}
                onChange={(e) => setBlurDepth(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            {/* Slider 2: Corner Sharpness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#9490ac]">SVG Corner Sharpness / Bevel</span>
                <span className="text-[#00ffcc] font-bold">{cornerSharpness}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                step="1"
                value={cornerSharpness}
                onChange={(e) => setCornerSharpness(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            {/* Slider 3: Glow Pulse Velocity */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#9490ac]">Glow Pulse Velocity</span>
                <span className="text-[#00ffcc] font-bold">{glowPulseVelocity}s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={glowPulseVelocity}
                onChange={(e) => setGlowPulseVelocity(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            {/* Slider 4: Border Stroke Weight */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#9490ac]">Border Stroke Weight</span>
                <span className="text-[#00ffcc] font-bold">{borderStrokeWeight}px</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={borderStrokeWeight}
                onChange={(e) => setBorderStrokeWeight(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* PANEL 2: DUAL-VIEWPORT SANDBOX CANVASES (CENTER - 50%)   */}
        {/* ======================================================== */}
        <section className="xl:col-span-6 flex flex-col rounded-2xl border border-[#6366f1]/25 bg-[#0a071b] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)] relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-[#00ffcc]" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Dual-Viewport Sandbox Canvases
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-ping" />
              <span className="font-mono text-[10px] text-[#00ffcc]">
                SIMULATION ACTIVE // 60 FPS
              </span>
            </div>
          </div>

          {/* Floating Interactive Modifier Deck */}
          <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6366f1]/35 bg-[#000000]/80 p-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                onClick={cycleInteractiveState}
                className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/50 bg-[#6366f1]/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-[#6366f1] hover:bg-[#6366f1]/30 active:scale-95"
              >
                <Zap className="size-3.5 text-[#00ffcc]" />
                <span>Toggle Interactive Event States:</span>
                <span className="font-mono text-[#00ffcc] uppercase">[{simulatedState}]</span>
              </button>

              <button
                onClick={toggleBrandInvert}
                className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/50 bg-[#6366f1]/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-[#6366f1] hover:bg-[#6366f1]/30 active:scale-95"
              >
                <Radio className="size-3.5 text-[#00ffcc]" />
                <span>Invert Brand Color Distribution</span>
              </button>
            </div>

            <button
              onClick={handleReScaffold}
              className="flex items-center gap-1 rounded-lg border border-[#00ffcc]/40 bg-[#00ffcc]/10 px-2.5 py-1 text-xs font-mono font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/20 active:scale-95"
            >
              <RefreshCw className={`size-3 ${isCompiling ? "animate-spin" : ""}`} />
              <span>Force Clean Re-Scaffold</span>
            </button>
          </div>

          {/* DUAL SIMULATION BLOCKS (Viewport A: Desktop & Viewport B: Mobile Nexus HUD) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-start overflow-y-auto pr-1">
            
            {/* VIEWPORT A: DESKTOP SHEET (Uncompressed Widescreen Frame) */}
            <div className="md:col-span-7 flex flex-col gap-2 rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-3">
              <div className="flex items-center justify-between border-b border-[#6366f1]/15 pb-2">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-white">
                  <Monitor className="size-3.5 text-[#6366f1]" />
                  <span>VIEWPORT A: DESKTOP SHEET (100% WIDESCREEN)</span>
                </div>
                <span className="font-mono text-[10px] text-[#00ffcc]">UNCOMPRESSED</span>
              </div>

              {/* Staging Component Render */}
              <div className="py-2">
                <div
                  id="preview-root-card"
                  className={`relative w-full overflow-hidden transition-all duration-300 ${
                    highlightedNode === "root-card"
                      ? "ring-2 ring-[#00ffcc] ring-offset-2 ring-offset-black"
                      : ""
                  } ${
                    simulatedState === "hover"
                      ? "scale-[1.01]"
                      : simulatedState === "active"
                      ? "scale-[0.98]"
                      : ""
                  }`}
                  style={{
                    borderRadius: `${cornerSharpness}px`,
                    borderWidth: `${borderStrokeWeight}px`,
                    borderColor: `${primaryThemeColor}66`,
                    backgroundColor: "#0a071b",
                    backdropFilter: `blur(${blurDepth}px)`,
                    boxShadow: `0 16px 40px -10px rgba(0, 0, 0, 0.8), 0 0 24px -4px ${primaryThemeColor}44`,
                  }}
                >
                  {/* Top Laser Accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                      background: `linear-gradient(90deg, ${primaryThemeColor}, ${accentThemeColor}, transparent)`,
                      animation: `pulse ${glowPulseVelocity}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                    }}
                  />

                  {/* Header Beacon */}
                  <header
                    className={`flex items-center justify-between border-b border-[#6366f1]/20 px-4 py-3 ${
                      highlightedNode === "header-telemetry"
                        ? "ring-1 ring-[#00ffcc] bg-[#00ffcc]/10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ffcc] opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00ffcc]" />
                      </span>
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#00ffcc]">
                        NEXUS // DESKTOP CORE
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#9490ac]">ID-904 // RUNNING</span>
                  </header>

                  {/* Body Glass Surface */}
                  <div
                    className={`space-y-3.5 p-4 ${
                      highlightedNode === "body-glass"
                        ? "ring-1 ring-[#00ffcc] bg-[#00ffcc]/5"
                        : ""
                    }`}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white sm:text-base leading-snug">
                        {prompt.slice(0, 48)}...
                      </h3>
                      <p className="mt-1 text-xs text-[#9490ac] leading-relaxed">
                        Precision engineering with zero-runtime slop. Dual-viewport synchronicity guaranteed.
                      </p>
                    </div>

                    {/* Metrics Data Bars */}
                    <div
                      className={`space-y-1.5 rounded-lg border border-[#6366f1]/20 bg-[#000000]/50 p-2.5 ${
                        highlightedNode === "metrics-stream"
                          ? "ring-1 ring-[#00ffcc]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-[#00ffcc]">
                        <span>TELEMETRY THROUGHPUT</span>
                        <span>0.0018s LATENCY</span>
                      </div>
                      <div className="flex h-2 w-full gap-1 overflow-hidden rounded bg-[#0a071b]">
                        {[45, 80, 60, 92, 75, 88, 95].map((val, i) => (
                          <div
                            key={i}
                            className={`h-full flex-1 rounded-sm transition-all ${
                              simulatedState === "streaming" ? "animate-cyber-stream" : ""
                            }`}
                            style={{
                              background: val > 85 ? "#00ffcc" : primaryThemeColor,
                              opacity: val / 100,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Interactive .omni-shortcut Element (1.05 hover, 0.95 active) */}
                    <div
                      className={`omni-shortcut p-3 rounded-xl border border-[#a78bfa]/25 bg-gradient-to-br from-[#181224]/90 to-[#0a0910]/98 ${
                        highlightedNode === "shortcut-interactive"
                          ? "ring-2 ring-[#00ffcc]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="size-4 text-[#00ffcc]" />
                          <span className="font-semibold text-xs text-white">
                            Physical Touch Sensor (.omni-shortcut)
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#00ffff]">
                          HOVER 1.05 / PRESS 0.95
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Cluster */}
                  <footer
                    className={`border-t border-[#6366f1]/20 bg-[#000000]/40 px-4 py-2.5 flex items-center justify-between ${
                      highlightedNode === "footer-action" ? "ring-1 ring-[#00ffcc]" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#9490ac]">STATUS: NOMINAL</span>
                    <button
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black transition hover:brightness-110 active:scale-95"
                      style={{ background: accentThemeColor }}
                    >
                      Execute Directive
                    </button>
                  </footer>
                </div>
              </div>
            </div>

            {/* VIEWPORT B: MOBILE NEXUS HUD (Exact Mobile Viewport Frame) */}
            <div className="md:col-span-5 flex flex-col gap-2 rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-3 items-center">
              <div className="flex items-center justify-between w-full border-b border-[#6366f1]/15 pb-2">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-white">
                  <Smartphone className="size-3.5 text-[#00ffcc]" />
                  <span>VIEWPORT B: MOBILE NEXUS HUD</span>
                </div>
                <span className="font-mono text-[10px] text-[#00ffcc]">360px</span>
              </div>

              {/* Mobile Device Simulation Bezel */}
              <div className="w-full max-w-[320px] rounded-[24px] border-2 border-[#352e52] bg-[#000000] p-2.5 shadow-[0_0_24px_rgba(99,102,241,0.2)]">
                {/* Mobile Speaker / Notch */}
                <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#352e52]" />

                {/* Mobile Screen Component Render */}
                <div
                  className={`w-full overflow-hidden transition-all duration-300 ${
                    highlightedNode === "root-card" ? "ring-1 ring-[#00ffcc]" : ""
                  }`}
                  style={{
                    borderRadius: `${Math.min(cornerSharpness, 14)}px`,
                    borderWidth: `${borderStrokeWeight}px`,
                    borderColor: `${primaryThemeColor}66`,
                    backgroundColor: "#0a071b",
                  }}
                >
                  {/* Top Laser */}
                  <div
                    className="h-[2px] w-full"
                    style={{
                      background: `linear-gradient(90deg, ${primaryThemeColor}, ${accentThemeColor})`,
                    }}
                  />

                  {/* Mobile Header */}
                  <div
                    className={`flex items-center justify-between border-b border-[#6366f1]/20 px-3 py-2 ${
                      highlightedNode === "header-telemetry" ? "ring-1 ring-[#00ffcc]" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#00ffcc] font-bold">
                      NEXUS MOBILE HUD
                    </span>
                    <span className="size-2 rounded-full bg-[#00ffcc]" />
                  </div>

                  {/* Mobile Body */}
                  <div
                    className={`p-3 space-y-2.5 ${
                      highlightedNode === "body-glass" ? "ring-1 ring-[#00ffcc]" : ""
                    }`}
                  >
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {prompt.slice(0, 32)}...
                    </h4>

                    {/* Compact Mobile Stream */}
                    <div
                      className={`rounded border border-[#6366f1]/20 bg-[#000000]/60 p-2 ${
                        highlightedNode === "metrics-stream" ? "ring-1 ring-[#00ffcc]" : ""
                      }`}
                    >
                      <div className="flex justify-between font-mono text-[9px] text-[#00ffcc]">
                        <span>TELEMETRY</span>
                        <span>0.0018s</span>
                      </div>
                      <div className="mt-1 flex h-1.5 w-full gap-0.5">
                        {[40, 70, 90, 85].map((val, i) => (
                          <div
                            key={i}
                            className="h-full flex-1 rounded-sm"
                            style={{ background: "#00ffcc" }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mobile .omni-shortcut */}
                    <div
                      className={`omni-shortcut p-2.5 rounded-lg border border-[#a78bfa]/25 bg-[#181224] ${
                        highlightedNode === "shortcut-interactive" ? "ring-1 ring-[#00ffcc]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                        <span>Physical Press</span>
                        <span className="text-[#00ffff] font-mono text-[9px]">0.95</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Footer */}
                  <div
                    className={`border-t border-[#6366f1]/20 p-2 text-center ${
                      highlightedNode === "footer-action" ? "ring-1 ring-[#00ffcc]" : ""
                    }`}
                  >
                    <button
                      className="w-full rounded py-1 text-[11px] font-bold text-black"
                      style={{ background: accentThemeColor }}
                    >
                      Dispatch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SYSTEM TELEMETRY LINE (Absolute Bottom Margin in Vibrant Neon Green #00ffcc) */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#00ffcc]/30 bg-[#000000] px-4 py-2 font-mono text-xs text-[#00ffcc]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-pulse" />
              <span className="font-semibold">
                [Nexus-UI: WebGPU Component Compiler / Unified Tailwind v4 Tokens Active]
              </span>
            </div>
            <span className="hidden sm:inline text-[#9490ac] text-[11px]">
              VRAM BUFFERS: 24.8MB // LATENCY: 0.0018s
            </span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* PANEL 3: SCHEMATICS & PRODUCTION DISPATCH (RIGHT - 25%)   */}
        {/* ======================================================== */}
        <section className="xl:col-span-3 flex flex-col gap-4 rounded-2xl border border-[#6366f1]/25 bg-[#0a071b] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-[#00ffcc]" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Specification Schematics
              </h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc]">PANEL 03 // DISPATCH</span>
          </div>

          {/* Active DOM Path Hierarchy Tree */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#9490ac] flex items-center justify-between">
              <span>ACTIVE DOM PATH HIERARCHY</span>
              <span className="font-mono text-[10px] text-[#00ffcc]">CLICK TO INSPECT</span>
            </label>

            <div className="rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-2 font-mono text-xs space-y-1">
              {DOM_HIERARCHY.map((node) => (
                <div key={node.id} className="space-y-1">
                  <button
                    onClick={() =>
                      setHighlightedNode((curr) => (curr === node.id ? null : node.id))
                    }
                    className={`w-full text-left px-2 py-1 rounded transition flex items-center justify-between ${
                      highlightedNode === node.id
                        ? "bg-[#00ffcc]/20 text-[#00ffcc] font-bold border border-[#00ffcc]/50"
                        : "text-[#d8d3ef] hover:bg-white/5"
                    }`}
                  >
                    <span>▾ {node.name}</span>
                    <span className="text-[10px] text-[#9490ac]">{node.tag}</span>
                  </button>

                  {node.children && (
                    <div className="pl-3 space-y-1 border-l border-[#6366f1]/25 ml-2">
                      {node.children.map((child) => (
                        <div key={child.id} className="space-y-1">
                          <button
                            onClick={() =>
                              setHighlightedNode((curr) =>
                                curr === child.id ? null : child.id
                              )
                            }
                            className={`w-full text-left px-2 py-0.5 rounded transition flex items-center justify-between ${
                              highlightedNode === child.id
                                ? "bg-[#00ffcc]/20 text-[#00ffcc] font-bold border border-[#00ffcc]/50"
                                : "text-[#c4b5fd] hover:bg-white/5"
                            }`}
                          >
                            <span>• {child.name}</span>
                            <span className="text-[9px] text-[#9490ac]">{child.tag}</span>
                          </button>

                          {child.children && (
                            <div className="pl-3 space-y-1 border-l border-[#6366f1]/25 ml-2">
                              {child.children.map((sub) => (
                                <button
                                  key={sub.id}
                                  onClick={() =>
                                    setHighlightedNode((curr) =>
                                      curr === sub.id ? null : sub.id
                                    )
                                  }
                                  className={`w-full text-left px-2 py-0.5 rounded transition flex items-center justify-between ${
                                    highlightedNode === sub.id
                                      ? "bg-[#00ffcc]/20 text-[#00ffcc] font-bold border border-[#00ffcc]/50"
                                      : "text-[#a78bfa] hover:bg-white/5"
                                  }`}
                                >
                                  <span>↳ {sub.name}</span>
                                  <span className="text-[9px] text-[#9490ac]">{sub.tag}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Compilation Output Terminal (Monospaced #00ffcc on Pure Black #000000) */}
          <div className="flex flex-col gap-1.5 flex-1 min-h-[160px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#00ffcc]">
                <TerminalIcon className="size-3 text-[#00ffcc]" />
                <span>COMPILATION OUTPUT TERMINAL</span>
              </div>
              <span className="font-mono text-[9px] text-[#9490ac]">JIT STREAM</span>
            </div>

            <div
              ref={terminalRef}
              className="flex-1 max-h-[190px] overflow-y-auto rounded-xl border border-[#00ffcc]/30 bg-[#000000] p-3 font-mono text-[10px] leading-relaxed text-[#00ffcc] select-text shadow-inner"
            >
              {logs.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Production-Grade Code Exporter Button Stack */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#6366f1]/20">
            <label className="text-xs font-semibold text-[#9490ac]">
              PRODUCTION-GRADE EXPORTER
            </label>

            {/* Button 1: Copy Clean Code */}
            <button
              onClick={handleCopyCode}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#6366f1]/40 bg-[#6366f1]/20 py-2.5 px-3 text-xs font-semibold text-white shadow-sm transition hover:border-[#6366f1] hover:bg-[#6366f1]/30 active:scale-95"
            >
              {copiedCode ? (
                <>
                  <Check className="size-4 text-[#00ffcc]" />
                  <span className="text-[#00ffcc]">Code Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="size-4 text-[#00ffcc]" />
                  <span>Copy Clean Component Code to Clipboard</span>
                </>
              )}
            </button>

            {/* Button 2: Export to Cursor Project Directory */}
            <button
              onClick={handleExportCursor}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#6366f1]/40 bg-[#000000]/60 py-2.5 px-3 text-xs font-semibold text-white transition hover:border-[#00ffcc] hover:text-[#00ffcc] active:scale-95"
            >
              {exportedCursor ? (
                <>
                  <Check className="size-4 text-[#00ffcc]" />
                  <span className="text-[#00ffcc]">Exported to Cursor Project!</span>
                </>
              ) : (
                <>
                  <Download className="size-4 text-[#6366f1]" />
                  <span>Export Code Package Direct to Cursor Directory</span>
                </>
              )}
            </button>

            {/* Button 3: Push to Omni Video / Storyboard */}
            <button
              onClick={handlePushStaging}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#00ffcc]/40 bg-[#00ffcc]/10 py-2.5 px-3 text-xs font-semibold text-[#00ffcc] transition hover:bg-[#00ffcc]/20 active:scale-95"
            >
              {pushedStaging ? (
                <>
                  <Check className="size-4 text-[#00ffcc]" />
                  <span>Pushed to Staging Bays!</span>
                </>
              ) : (
                <>
                  <Send className="size-4 text-[#00ffcc]" />
                  <span>Push Layout Component to Omni Video / Storyboard</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>

      {/* Raw Code Inspector Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-[#6366f1]/40 bg-[#0a071b] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#6366f1]/30 pb-4">
              <div className="flex items-center gap-2">
                <Code className="size-5 text-[#00ffcc]" />
                <h3 className="font-bold text-white text-base">
                  Generated Production Source: {framework.toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <pre className="mt-4 flex-1 overflow-auto rounded-xl border border-[#00ffcc]/30 bg-[#000000] p-4 font-mono text-xs text-[#00ffcc] select-text">
              {generatedCode}
            </pre>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 rounded-xl bg-[#00ffcc] px-4 py-2 text-xs font-bold text-black hover:brightness-110 active:scale-95"
              >
                <Copy className="size-3.5" />
                <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
