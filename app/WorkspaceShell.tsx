
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import FluidCanvas from "./hud/FluidCanvas";
import MediaLinkVault from "./hud/MediaLinkVault";
import { DirectorSwitchBar } from "./hud/DirectorSwitch";

import HeaderBrandingOrb from "@/components/HeaderBrandingOrb";
import StudioToggleMatrix from "@/components/StudioToggleMatrix";
import StudioVoiceAssistantOverlay from "@/components/StudioVoiceAssistantOverlay";
import { orbEngineStore } from "@/lib/orbEngineStore";

export default function WorkspaceShell({
  children,
}: {
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Sync active studio context
  useEffect(() => {
    let contextName = "Universal Matrix";
    if (pathname.includes("face-swap")) contextName = "OmniStyle Studio";
    else if (pathname.includes("mv-studio")) contextName = "OmniBeat Studio";
    else if (pathname.includes("storyboard")) contextName = "Omni Storyboard";
    else if (pathname.includes("music")) contextName = "Music Studio";
    else if (pathname.includes("video")) contextName = "Video Studio";
    else if (pathname.includes("image")) contextName = "Image Studio";
    else if (pathname.includes("voice")) contextName = "Voice Studio";
    else if (pathname === "/") contextName = "OmniAI Chat";
    orbEngineStore.setActiveStudioContext(contextName);
  }, [pathname]);

  // Live credit balance for the wallet chip.
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data } = await supabase.rpc("omni_credit_balance");
        if (alive && typeof data === "number") setBalance(data);
      } catch {
        /* signed out or billing migration not run */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isChat = pathname === "/";

  useEffect(() => {
    if (isChat) setNavOpen(false);
  }, [isChat]);

  function closeNavigation() {
    setNavOpen(false);
  }

  const handleNavigate = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setNavOpen(false);
    }
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full max-w-full overflow-x-hidden">
      <FluidCanvas intensity={0.28} />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,_rgba(108,99,255,0.06),transparent_55%)]" aria-hidden="true" />
      <Sidebar
        mobileOpen={navOpen}
        onClose={closeNavigation}
        onNavigate={handleNavigate}
        overlay
      />

      <div className="relative z-[2] flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden">
        {/* Universal Studio Voice Assistant Slide-Down Panel */}
        <StudioVoiceAssistantOverlay />

        <header
          className="syn-workspace-header flex min-h-14 w-full min-w-0 max-w-full shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(11,10,20,0.62)] px-4 py-2 backdrop-blur-[24px] sm:h-14 sm:flex-nowrap sm:py-0 sm:px-6"
          style={{ WebkitBackdropFilter: "blur(24px)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#30294c] bg-[#151124] text-[#c5bdff] transition hover:border-[#7164df] hover:bg-[#201a37] focus:outline-none focus:ring-2 focus:ring-[#8b7fff]"
              aria-label={navOpen ? "Hide navigation menu" : "Open navigation menu"}
              aria-expanded={navOpen}
              aria-controls="synaptex-sidebar"
              onClick={() => setNavOpen((open) => !open)}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* STEP 2: HEADER BRANDING ORB (48px x 48px square asset in far upper-left corner) */}
            <HeaderBrandingOrb />
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* STEP 4: UNIVERSAL STUDIO TOGGLE MATRIX (Space-saving toggle switch) */}
            <StudioToggleMatrix />

            {/* Director Mode — executive control module */}
            <div className="hidden sm:block">
              <DirectorSwitchBar />
            </div>

            {/* Global profile + credit wallet chip */}
            <a
              href="/settings"
              className="hidden shrink-0 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(20,18,31,0.55)] px-3 py-1 text-[11px] text-[#c5bfff] backdrop-blur-[20px] transition hover:border-[#a69eff]/60 sm:text-xs md:flex"
              title="Credit wallet & profile"
            >
              <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-[#6c63ff] to-[#e879f9] text-[9px] font-bold text-white">OM</span>
              <span className="dms-mono tracking-[0.12em]">
                {balance === null ? "— CR" : `${balance.toLocaleString("en-US")} CR`}
              </span>
            </a>

            <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#9490ac] sm:text-xs">
              <span className="dms-live-dot" aria-hidden="true" />
              <span className="dms-mono hidden tracking-[0.16em] sm:inline">
                STUDIO ONLINE
              </span>
              <span className="dms-mono tracking-[0.16em] sm:hidden">ONLINE</span>
            </div>
          </div>
        </header>

        <main
          className={
            isChat
              ? "relative z-[2] flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden"
              : "relative z-[2] flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8"
          }
        >
          <div className="relative flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
      <MediaLinkVault />
    </div>
  );
}
