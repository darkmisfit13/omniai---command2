"use client";

import OmniChatOrbWebGL from "./OmniChatOrbWebGL";
import { useOrbEngine, orbEngineStore, type OrbEngineState } from "@/lib/orbEngineStore";
import { Sparkles, Cpu, Radio, Volume2, Shield } from "lucide-react";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: CENTER DASHBOARD CONVERSATION CORE
   Absolute Black Cyberpunk: Pure Black #000000, Obsidian-Purple #0a071b,
   Purplish-Blue #0C00CA, Baby Blue #00ffff.
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
              ? "bg-[radial-gradient(circle_at_center,_#0C00CA_0%,_transparent_65%)]"
              : "bg-[radial-gradient(circle_at_center,_#00ffff_0%,_transparent_65%)]"
          }`}
        />

        {/* Top Header Row with High-Contrast Baby Blue Telemetry */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#1f1638] pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                state === "thinking"
                  ? "bg-[#0C00CA] shadow-[0_0_12px_#0C00CA] animate-ping"
                  : state === "talking"
                  ? "bg-[#00ffff] shadow-[0_0_12px_#00ffff] animate-pulse"
                  : "bg-[#00ffff] shadow-[0_0_8px_#00ffff]"
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              OmniAI Core · Neural Viewport
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-300 bg-[#000000] border border-[#1f1638] px-2 py-0.5 rounded-md">
              Context: <span className="text-[#00ffff] font-bold">{activeStudioContext}</span>
            </span>
            <span className="font-mono text-[10px] text-slate-300 bg-[#000000] border border-[#1f1638] px-2 py-0.5 rounded-md hidden xs:inline">
              LPU: <span className="text-[#00ffff] font-bold">{latencyMs.toFixed(1)}ms</span>
            </span>
          </div>
        </div>

        {/* Global Standard Telemetry Line */}
        <div className="mb-3 px-3 py-1.5 rounded-lg border border-[#00ffff]/40 bg-[#000000] flex items-center justify-between shadow-[0_0_10px_rgba(0,255,255,0.15)]">
          <span className="font-mono text-[10px] font-bold text-[#00ffff] tracking-wide">
            [Nexus-Inference: Max-Speed / Local-Ollama Override]
          </span>
          <span className="font-mono text-[9px] text-[#00ffff] flex items-center gap-1 font-semibold">
            <span className="size-1.5 rounded-full bg-[#00ffff] shadow-[0_0_6px_#00ffff]" />
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
                      ? "#00ffff"
                      : state === "thinking"
                      ? "#0C00CA"
                      : "#1f1638",
                  boxShadow:
                    state === "talking"
                      ? "0 0 10px rgba(0,255,255,0.7)"
                      : state === "thinking"
                      ? "0 0 10px rgba(12,0,202,0.7)"
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
                  ? "border-[#00ffff] bg-[#00ffff]/15 text-[#00ffff] shadow-[0_0_12px_rgba(0,255,255,0.35)]"
                  : "border-[#1f1638] bg-[#000000] text-slate-400 hover:text-white hover:border-[#0C00CA]"
              }`}
            >
              [Idle Wave]
            </button>

            <button
              onClick={() => handleStateChange("thinking")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "thinking"
                  ? "border-[#0C00CA] bg-[#0C00CA] text-white shadow-[0_0_18px_rgba(12,0,202,0.65)] animate-pulse"
                  : "border-[#1f1638] bg-[#000000] text-slate-400 hover:text-white hover:border-[#0C00CA]"
              }`}
            >
              [Thinking / Council]
            </button>

            <button
              onClick={() => handleStateChange("talking")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "talking"
                  ? "border-[#00ffff] bg-[#00ffff]/20 text-[#00ffff] shadow-[0_0_14px_rgba(0,255,255,0.4)]"
                  : "border-[#1f1638] bg-[#000000] text-slate-400 hover:text-white hover:border-[#0C00CA]"
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
