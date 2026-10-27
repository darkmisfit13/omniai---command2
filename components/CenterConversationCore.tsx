"use client";

import OmniChatOrbWebGL from "./OmniChatOrbWebGL";
import { useOrbEngine, orbEngineStore, type OrbEngineState } from "@/lib/orbEngineStore";
import { Sparkles, Cpu, Radio, Volume2, Shield } from "lucide-react";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: CENTER DASHBOARD CONVERSATION CORE
   Obsidian Cyberpunk: Pure Black #000000, Obsidian-Purple #0a071b,
   Purplish-Blue #6366f1, Vibrant Neon Green #00ffcc.
========================================================================= */

export default function CenterConversationCore() {
  const { state, latencyMs, audioFrequencies, activeStudioContext } = useOrbEngine();

  const handleStateChange = (newState: OrbEngineState) => {
    orbEngineStore.setOrbState(newState);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-3 sm:p-5 my-2">
      {/* Container Block: Obsidian-Purple Container (#0a071b) with Border (#1f1638) */}
      <div className="w-full max-w-2xl rounded-3xl border border-[#1f1638] bg-[#0a071b] p-4 sm:p-6 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] relative overflow-hidden">
        {/* Holographic Glowing Accent Boundary */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-20 ${
            state === "thinking"
              ? "bg-[radial-gradient(circle_at_center,_#6366f1_0%,_transparent_65%)]"
              : "bg-[radial-gradient(circle_at_center,_#00ffcc_0%,_transparent_65%)]"
          }`}
        />

        {/* Top Header Row with High-Contrast Vibrant Neon Green Telemetry */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#1f1638] pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                state === "thinking"
                  ? "bg-[#6366f1] shadow-[0_0_12px_#6366f1] animate-ping"
                  : state === "talking"
                  ? "bg-[#00ffcc] shadow-[0_0_12px_#00ffcc] animate-pulse"
                  : "bg-[#00ffcc] shadow-[0_0_8px_#00ffcc]"
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              OmniAI Core · Neural Viewport
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-300 bg-[#000000] border border-[#1f1638] px-2 py-0.5 rounded-md">
              Context: <span className="text-[#00ffcc] font-bold">{activeStudioContext}</span>
            </span>
            <span className="font-mono text-[10px] text-slate-300 bg-[#000000] border border-[#1f1638] px-2 py-0.5 rounded-md hidden xs:inline">
              LPU: <span className="text-[#00ffcc] font-bold">{latencyMs.toFixed(1)}ms</span>
            </span>
          </div>
        </div>

        {/* Global Standard Telemetry Line */}
        <div className="mb-3 px-3 py-1.5 rounded-lg border border-[#00ffcc]/30 bg-[#000000] flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold text-[#00ffcc] tracking-wide">
            [Nexus-Inference: Max-Speed / Local-Ollama Override]
          </span>
          <span className="font-mono text-[9px] text-[#00ffcc] flex items-center gap-1 font-semibold">
            <span className="size-1.5 rounded-full bg-[#00ffcc] shadow-[0_0_6px_#00ffcc]" />
            ACTIVE
          </span>
        </div>

        {/* Center WebGL High-Fidelity Rendering Canvas */}
        <div className="relative flex flex-col items-center justify-center py-2">
          <OmniChatOrbWebGL
            size="hero"
            customWidth={360}
            customHeight={320}
            showBadge={true}
            interactive={true}
            onOrbClick={() => {
              const next: OrbEngineState =
                state === "idle" ? "thinking" : state === "thinking" ? "talking" : "idle";
              orbEngineStore.setOrbState(next);
            }}
          />

          {/* Real-time Responsive Audio Waveform Frequency Bar Matrix */}
          <div className="mt-3 flex items-center justify-center gap-1.5 h-6 w-full max-w-xs">
            {audioFrequencies.map((freq, idx) => (
              <div
                key={idx}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: state === "talking" ? `${Math.max(4, freq * 24)}px` : "4px",
                  backgroundColor:
                    state === "talking"
                      ? "#00ffcc"
                      : state === "thinking"
                      ? "#6366f1"
                      : "#1f1638",
                  boxShadow:
                    state === "talking"
                      ? "0 0 10px rgba(0,255,204,0.7)"
                      : state === "thinking"
                      ? "0 0 10px rgba(99,102,241,0.7)"
                      : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* State Selection Test Deck */}
        <div className="mt-4 pt-3 border-t border-[#1f1638] flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase text-slate-400">
            ENGINE SIMULATION MODES:
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleStateChange("idle")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "idle"
                  ? "border-[#00ffcc] bg-[#00ffcc]/15 text-[#00ffcc] shadow-[0_0_12px_rgba(0,255,204,0.35)]"
                  : "border-[#1f1638] bg-[#000000] text-slate-400 hover:text-white hover:border-[#6366f1]"
              }`}
            >
              [Idle Wave]
            </button>

            <button
              onClick={() => handleStateChange("thinking")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "thinking"
                  ? "border-[#6366f1] bg-[#6366f1] text-white shadow-[0_0_16px_rgba(99,102,241,0.6)] animate-pulse"
                  : "border-[#1f1638] bg-[#000000] text-slate-400 hover:text-white hover:border-[#6366f1]"
              }`}
            >
              [Thinking / Council]
            </button>

            <button
              onClick={() => handleStateChange("talking")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "talking"
                  ? "border-[#00ffcc] bg-[#00ffcc]/20 text-[#00ffcc] shadow-[0_0_14px_rgba(0,255,204,0.4)]"
                  : "border-[#1f1638] bg-[#000000] text-slate-400 hover:text-white hover:border-[#6366f1]"
              }`}
            >
              [Talking Back]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
