
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function WorkspaceShell({
  children,
}: {
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // The workspace nav is an overlay on every route, not just chat. Taking it
  // out of the flow gives each page the full stage — the chat needs it for the
  // hologram, and the studios need it for the timeline and preview.
  const isChat = pathname === "/";

  // Chat is meant to arrive clear: no rail, nothing between the user and the
  // orb. This only fires when the route actually changes, so opening the rail
  // deliberately while you are in chat still works.
  useEffect(() => {
    if (isChat) setNavOpen(false);
  }, [isChat]);

  function closeNavigation() {
    setNavOpen(false);
  }

  // On a phone the rail sits over the content, so it closes behind you. On a
  // wide screen it is the app's navigation rather than an interruption, so it
  // stays put while you move between routes.
  const handleNavigate = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setNavOpen(false);
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full">
      <Sidebar
        mobileOpen={navOpen}
        onClose={closeNavigation}
        onNavigate={handleNavigate}
        overlay
      />

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header className="syn-workspace-header flex h-14 shrink-0 items-center justify-between border-b border-[#211d34] bg-[#0b0a14]/90 px-4 sm:px-6">
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

            <div className="truncate text-xs tracking-[0.16em] text-[#9490ac]">
              <span className="dms-display font-extrabold tracking-[0.02em] text-[#c5bfff]">
                OmniAI
              </span>
              <span className="mx-2 text-[#393252]">/</span>
              <span className="dms-mono text-[10px] tracking-[0.18em]">
                DARKMISFITSTUDIOS
              </span>
            </div>
          </div>

          <div className="ml-3 flex shrink-0 items-center gap-2 text-[11px] text-[#9490ac] sm:text-xs">
            <span className="dms-live-dot" aria-hidden="true" />
            <span className="dms-mono hidden tracking-[0.16em] sm:inline">
              STUDIO ONLINE
            </span>
            <span className="dms-mono tracking-[0.16em] sm:hidden">ONLINE</span>
          </div>
        </header>

        <main
          className={
            isChat
              ? "min-h-0 flex-1 overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
