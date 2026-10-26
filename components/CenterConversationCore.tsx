"use client";

import OmniChatOrbWebGL from "./OmniChatOrbWebGL";
import { useOrbEngine, orbEngineStore, type OrbEngineState } from "@/lib/orbEngineStore";
import { Sparkles, Cpu, Radio, Volume2, Shield } from "lucide-react";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: CENTER DASHBOARD CONVERSATION CORE
   Expanded physical scale WebGL viewport container centered right above the chat box
========================================================================= */

export default function CenterConversationCore() {
  const { state, latencyMs, audioFrequencies, activeStudioContext } = useOrbEngine();

  const handleStateChange = (newState: OrbEngineState) => {
    orbEngineStore.setOrbState(newState);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-3 sm:p-5 my-2">
      {/* Container Block: Dark Bluish Purple Container with Obsidian Glass */}
      <div className="w-full max-w-2xl rounded-3xl border border-[#2e2055] bg-gradient-to-b from-[#0e0a1c]/90 via-[#120d24]/80 to-[#000000]/95 p-4 sm:p-6 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
        {/* Holographic Geometric Radial Background Decor */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-25 ${
            state === "thinking"
              ? "bg-[radial-gradient(circle_at_center,_#FF003C_0%,_transparent_65%)]"
              : "bg-[radial-gradient(circle_at_center,_#00D2FF_0%,_transparent_65%)]"
          }`}
        />

        {/* Top Header Row of the Core Viewport */}
        <div className="flex items-center justify-between border-b border-[#2e2055]/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                state === "thinking"
                  ? "bg-[#FF003C] shadow-[0_0_12px_#FF003C] animate-ping"
                  : state === "talking"
                  ? "bg-[#00D2FF] shadow-[0_0_10px_#00D2FF] animate-pulse"
                  : "bg-white shadow-[0_0_8px_#FFFFFF]"
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              OmniAI Core · Neural Viewport
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-400 bg-black/50 border border-[#2e2055] px-2 py-0.5 rounded-md">
              Context: <span className={state === "thinking" ? "text-[#FF003C]" : "text-[#00D2FF]"}>{activeStudioContext}</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400 bg-black/50 border border-[#2e2055] px-2 py-0.5 rounded-md hidden xs:inline">
              LPU: <span className="text-white">{latencyMs.toFixed(1)}ms</span>
            </span>
          </div>
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
              // Cycle state on click for high interactivity
              const next: OrbEngineState =
                state === "idle" ? "thinking" : state === "thinking" ? "talking" : "idle";
              orbEngineStore.setOrbState(next);
            }}
          />

          {/* Real-time Responsive Audio Waveform Frequency Bar Matrix (for Talking State) */}
          <div className="mt-3 flex items-center justify-center gap-1.5 h-6 w-full max-w-xs">
            {audioFrequencies.map((freq, idx) => (
              <div
                key={idx}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: state === "talking" ? `${Math.max(4, freq * 24)}px` : "4px",
                  backgroundColor:
                    state === "talking"
                      ? "#00D2FF"
                      : state === "thinking"
                      ? "#FF003C"
                      : "#2e2055",
                  boxShadow:
                    state === "talking"
                      ? "0 0 10px rgba(0,210,255,0.7)"
                      : state === "thinking"
                      ? "0 0 10px rgba(255,0,60,0.7)"
                      : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* State Selection Test Deck */}
        <div className="mt-4 pt-3 border-t border-[#2e2055]/80 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase text-slate-400">
            ENGINE SIMULATION MODES:
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleStateChange("idle")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "idle"
                  ? "border-[#00D2FF] bg-[#00D2FF]/20 text-[#00D2FF] shadow-[0_0_12px_rgba(0,210,255,0.35)]"
                  : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:text-white"
              }`}
            >
              [Idle Wave]
            </button>

            <button
              onClick={() => handleStateChange("thinking")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "thinking"
                  ? "border-[#FF003C] bg-[#FF003C] text-white shadow-[0_0_16px_rgba(255,0,60,0.6)] animate-pulse"
                  : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:text-white"
              }`}
            >
              [Thinking / Council]
            </button>

            <button
              onClick={() => handleStateChange("talking")}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                state === "talking"
                  ? "border-[#00D2FF] bg-[#00D2FF]/20 text-white shadow-[0_0_12px_rgba(0,210,255,0.4)]"
                  : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:text-white"
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
