"use client";

import { useOrbEngine, orbEngineStore } from "@/lib/orbEngineStore";
import { Sparkles, MessageSquare, Terminal, ChevronDown } from "lucide-react";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: UNIVERSAL STUDIO TOGGLE MATRIX
   Clean, space-saving toggle switch in far upper-right corner of studio layouts
========================================================================= */

interface StudioToggleMatrixProps {
  studioName?: string;
  className?: string;
}

export default function StudioToggleMatrix({
  studioName = "Studio Workspace",
  className = "",
}: StudioToggleMatrixProps) {
  const { state, isOverlayOpen } = useOrbEngine();

  const handleToggle = () => {
    orbEngineStore.toggleOverlay(studioName);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleToggle}
        className={`group relative flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all duration-200 backdrop-blur-md shadow-lg ${
          isOverlayOpen
            ? state === "thinking"
              ? "border-[#FF003C] bg-[#FF003C]/20 text-[#FF003C] shadow-[0_0_20px_rgba(255,0,60,0.4)]"
              : "border-[#00D2FF] bg-[#00D2FF]/20 text-[#00D2FF] shadow-[0_0_20px_rgba(0,210,255,0.35)]"
            : "border-[#2e2055] bg-[#0e0a1c]/90 text-slate-300 hover:border-[#00D2FF]/60 hover:text-white hover:bg-[#16112c]"
        }`}
        title={`Open OmniAI Studio Voice Assistant for ${studioName}`}
      >
        {/* Animated indicator pulse */}
        <span
          className={`h-2 w-2 rounded-full transition ${
            isOverlayOpen || state === "thinking"
              ? "bg-[#FF003C] animate-ping"
              : state === "talking"
              ? "bg-[#00D2FF] animate-bounce"
              : "bg-[#00D2FF] group-hover:bg-white"
          }`}
        />

        <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider">
          <Terminal className={`h-3.5 w-3.5 ${state === "thinking" ? "text-[#FF003C]" : "text-[#00D2FF]"}`} />
          <span>OMNI ASSISTANT</span>
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${
            state === "thinking" ? "text-[#FF003C]" : "text-[#00D2FF]"
          } ${isOverlayOpen ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
