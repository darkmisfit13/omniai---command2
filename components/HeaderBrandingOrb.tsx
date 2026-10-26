"use client";

import OmniChatOrbWebGL from "./OmniChatOrbWebGL";
import { useOrbEngine, orbEngineStore } from "@/lib/orbEngineStore";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: HEADER BRANDING ORB
   Fixed 48px x 48px square asset in far upper-left corner preceding "OmniAI - Nexus"
========================================================================= */

export default function HeaderBrandingOrb() {
  const { state, latencyMs, isOverlayOpen } = useOrbEngine();

  const handleClick = () => {
    orbEngineStore.toggleOverlay();
  };

  return (
    <div className="flex items-center gap-3 shrink-0">
      {/* 48px x 48px square WebGL shader orb asset */}
      <div
        className="relative group cursor-pointer"
        onClick={handleClick}
        title={`OmniAI Core [${state.toUpperCase()}] · Click to toggle Voice Assistant`}
      >
        <OmniChatOrbWebGL
          size="compact"
          customWidth={48}
          customHeight={48}
          showBadge={false}
          className="shrink-0"
        />

        {/* Shimmering indicator ring for thinking mode */}
        {state === "thinking" && (
          <span className="absolute -inset-1 rounded-xl border border-[#FF003C]/80 shadow-[0_0_15px_#FF003C] animate-ping pointer-events-none" />
        )}
      </div>

      {/* Brand title block: Preceded by the 48x48 Orb */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-wide text-sm sm:text-base text-white hover:text-[#00D2FF] transition">
            OmniAI - Nexus
          </span>
          <span
            className={`hidden sm:inline-block rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
              state === "thinking"
                ? "border-[#FF003C]/80 bg-[#FF003C]/20 text-[#FF003C] shadow-[0_0_10px_rgba(255,0,60,0.5)]"
                : state === "talking"
                ? "border-[#00D2FF]/80 bg-[#00D2FF]/20 text-[#00D2FF]"
                : "border-[#00D2FF]/40 bg-[#0e0a1c] text-[#00D2FF]"
            }`}
          >
            {state === "idle" && "IDLE"}
            {state === "thinking" && `LPU ${latencyMs.toFixed(0)}ms`}
            {state === "talking" && "SPEAKING"}
          </span>
        </div>
        <span className="font-mono text-[9px] tracking-wider text-slate-400 hidden xs:inline">
          DARK MISFIT STUDIOS // OMNI ENGINE
        </span>
      </div>
    </div>
  );
}
