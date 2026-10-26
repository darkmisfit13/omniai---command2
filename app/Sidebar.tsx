
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Conversation } from "@/lib/types";

type IconName =
  | "dashboard"
  | "chat"
  | "website"
  | "approvals"
  | "audit"
  | "email"
  | "media"
  | "music"
  | "film"
  | "pulse"
  | "pricing"
  | "settings"
  | "diagnostics"
  | "plus"
  | "history"
  | "close";

/**
 * `hint` clarifies the creative tools, which otherwise read as three vaguely
 * interchangeable "video" rooms. It is the answer to "which one makes my
 * videos?" — so it stays one short line.
 */
const navigation: {
  label: string;
  href: string;
  icon: IconName;
  hint?: string;
}[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "AI Director", href: "/", icon: "chat", hint: "OmniAI Chat" },
  { label: "Omni Imagine", href: "/studio/image-studio", icon: "media", hint: "Image Studio" },
  { label: "OmniWave", href: "/studio/music", icon: "music", hint: "Music Studio" },
  { label: "OmniMotion", href: "/video-studio", icon: "film", hint: "Video Studio" },
  { label: "OmniBeat", href: "/studio/mv-studio", icon: "pulse", hint: "Music Video Studio" },
  { label: "OmniVoice", href: "/studio/voice-studio", icon: "media", hint: "Voice & Dubbing" },
  { label: "OmniStoryboard", href: "/studio/storyboard", icon: "audit", hint: "Scripts & Scenes" },
  { label: "OmniStyle", href: "/studio/face-swap", icon: "media", hint: "Outfit & Appearance" },
  { label: "Spatial 3D Studio", href: "/studio/spatial-3d", icon: "media", hint: "3D modeling & textures" },
  { label: "Vector & Brand Lab", href: "/studio/vector-graphics", icon: "media", hint: "Vector graphics & branding" },
  { label: "Viral Mockup", href: "/studio/viral-mockup", icon: "media", hint: "Social Feed Simulator" },
  { label: "OmniCode", href: "/studio/omnicode", icon: "dashboard", hint: "App & Web Builder" },
  { label: "Backend Architect", href: "/studio/backend-architect", icon: "audit", hint: "Database & API design" },
  { label: "Cosmic UI Lab", href: "/studio/ui-lab", icon: "media", hint: "UI components" },
  { label: "API & Webhook Lab", href: "/studio/api-connector", icon: "website", hint: "Build & simulate integrations" },
  { label: "OmniConnect", href: "/integrations", icon: "website", hint: "External app catalog" },
  { label: "Automations", href: "/automations", icon: "pulse", hint: "Preview workflows" },
  { label: "Prompt Studio", href: "/prompts", icon: "chat", hint: "Enhance prompts" },
  { label: "Media Library", href: "/studio/assets", icon: "media", hint: "Your creative files" },
  { label: "Website Analyzer", href: "/website", icon: "website", hint: "Audit site structure" },
  { label: "Inbox Prioritizer", href: "/email-triage", icon: "email", hint: "Email follow-ups" },
  { label: "Settings", href: "/settings", icon: "settings", hint: "Account & preferences" },
  { label: "Billing & Plans", href: "/settings/billing", icon: "pricing", hint: "Subscription & credits" },
  { label: "Approvals", href: "/approvals", icon: "approvals", hint: "Review AI actions" },
  { label: "Audit Log", href: "/audit-log", icon: "audit", hint: "System activity" },
  { label: "Local Diagnostics", href: "/local-diagnostics", icon: "diagnostics", hint: "Runtime & provider health" },
  { label: "Admin", href: "/admin", icon: "settings", hint: "Owner controls" },
];

const navGroups: {
  key: string;
  label: string;
  expandable?: boolean;
  accent: string;
  items: { label: string; href: string; icon: IconName; hint?: string }[];
}[] = (() => {
  function pick(href: string) {
    return navigation.find(function (i) { return i.href === href; });
  }
  function items(hrefList: string[]) {
    return hrefList.map(function (h) { return pick(h); }).filter(Boolean) as { label: string; href: string; icon: IconName; hint?: string }[];
  }
  return [
    { key: "core", label: "Core Intelligence", accent: "#a78bfa", items: items(["/dashboard", "/"]) },
    { key: "creative", label: "Creative Studios", accent: "#e879f9", items: items(["/studio/image-studio", "/studio/music", "/video-studio", "/studio/mv-studio", "/studio/voice-studio", "/studio/storyboard"]) },
    { key: "specialized", label: "Specialized Tools", accent: "#00f2fe", items: items(["/studio/face-swap", "/studio/spatial-3d", "/studio/vector-graphics", "/studio/viral-mockup"]) },
    { key: "build", label: "Build & Integrations", accent: "#6ee7b7", items: items(["/studio/app-builder", "/studio/backend-architect", "/studio/ui-lab", "/studio/api-connector", "/integrations", "/automations"]) },
    { key: "content", label: "Content & Productivity", accent: "#ffb84d", items: items(["/prompts", "/studio/assets", "/website", "/email-triage"]) },
    { key: "account", label: "Account", accent: "#4facfe", items: items(["/settings", "/settings/billing"]) },
    { key: "owner", label: "Owner Tools", accent: "#fb7185", expandable: true, items: items(["/approvals", "/audit-log", "/local-diagnostics", "/admin"]) },
  ];
})();

function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="11" width="7" height="10" rx="1.5" />
          <rect x="3" y="14" width="8" height="7" rx="1.5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      );
    case "website":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    case "approvals":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-3Z" />
          <path d="m8.5 12 2.3 2.3 4.7-4.8" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="M8 5h12M8 10h12M8 15h8M8 20h8" />
          <circle cx="4" cy="5" r=".7" fill="currentColor" />
          <circle cx="4" cy="10" r=".7" fill="currentColor" />
          <circle cx="4" cy="15" r=".7" fill="currentColor" />
          <circle cx="4" cy="20" r=".7" fill="currentColor" />
        </svg>
      );
    case "email":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "media":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 4.5-4.5 3.5 3 3-2.5L20 17" />
        </svg>
      );
    case "music":
      return (
        <svg {...common}>
          <path d="M9 17.2V6.4l9-2V15" />
          <circle cx="6.6" cy="17.6" r="2.4" />
          <circle cx="15.6" cy="15.4" r="2.4" />
        </svg>
      );
    case "film":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M8 5v14M16 5v14M3 12h18" />
        </svg>
      );
    case "pulse":
      return (
        <svg {...common}>
          <path d="M2.5 12h3.6l1.9-5.2 3.2 10.4 2.4-5.2H21.5" />
        </svg>
      );
    case "pricing":
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 9.5h19" />
          <path d="M6 14.5h4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.8 1l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.8-1l-1.5.6-1.5-2.6 1.2-1a7 7 0 0 1 0-2l-1.2-1 1.5-2.6 1.5.6a8 8 0 0 1 1.8-1l.3-1.6h3l.3 1.6a8 8 0 0 1 1.8 1l1.5-.6 1.5 2.6-1.2 1a7 7 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg {...common}>
          <path d="M3 12h4l2.5-6 4.5 12 2.5-6H21" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M8 9h8M8 12h8M8 15h5" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
  }
}

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  /**
   * Fired when a link is followed, as opposed to `onClose`, which is a
   * dismissal (backdrop, Escape, the X). Navigation hands off to the shell so a
   * wide screen can keep the rail up between routes while a narrow one lets it
   * close behind you.
   */
  onNavigate?: () => void;
  /**
   * Present the nav as an overlay at every viewport instead of only below
   * `md`. The shell passes this on every route so the stage keeps full width.
   */
  overlay?: boolean;
};

export default function Sidebar({
  mobileOpen,
  onClose,
  onNavigate,
  overlay = false,
}: SidebarProps) {
  const dismiss = onClose; // always close after navigation (per UX requirement)
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentConversationId = useCallback(() => {
    return searchParams.get("conversation");
  }, [searchParams]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [foldState, setFoldState] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = window.localStorage.getItem("ombi.sidebar.fold"); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => { try { window.localStorage.setItem("ombi.sidebar.fold", JSON.stringify(foldState)); } catch {} }, [foldState]);


  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore ? still redirect
    }
    router.push("/login");
  }

  const loadConversations = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setConversations([]);
      setHistoryError(null);
      return;
    }
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,created_at,archived_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setHistoryError(error.message);
      return;
    }

    setHistoryError(null);
    setConversations((data ?? []) as Conversation[]);
    setActiveId(currentConversationId());
  }, []);

  useEffect(() => {
    void loadConversations();

    const refresh = () => {
      setActiveId(currentConversationId());
      void loadConversations();
    };

    window.addEventListener("synaptex-conversations-changed", refresh);
    window.addEventListener("popstate", refresh);

    return () => {
      window.removeEventListener("synaptex-conversations-changed", refresh);
      window.removeEventListener("popstate", refresh);
    };
  }, [loadConversations, pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen, onClose]);

  async function createConversation() {
    if (creating) return;

    setCreating(true);
    setHistoryError(null);

    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title: "New chat" })
        .select("id,title,created_at,archived_at")
        .single();

      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("The new conversation has no ID.");

      setActiveId(data.id);
      await loadConversations();

      onClose();
      router.push(`/?conversation=${encodeURIComponent(data.id)}`);
      window.dispatchEvent(new Event("synaptex-conversations-changed"));
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Could not create a chat."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={0}
          onClick={onClose}
          className={`syn-sidebar-backdrop fixed inset-0 z-40 cursor-default bg-black/70 backdrop-blur-sm ${
            overlay ? "" : "md:hidden"
          }`}
        />
      )}

      <aside
        id="synaptex-sidebar"
        aria-label="OmniAI navigation"
        className={`syn-sidebar fixed inset-y-0 left-0 z-50 flex h-[100dvh] shrink-0 flex-col border-r border-[#302747] bg-[#0d0b17] px-3 py-5 overflow-y-auto overscroll-contain transition-transform duration-300 ease-out ${
          overlay ? "md:fixed md:z-50" : "md:static md:z-auto md:h-full md:translate-x-0"
        } ${
          mobileOpen
            ? "syn-sidebar-panel is-open translate-x-0 shadow-[20px_0_80px_rgba(0,0,0,0.45)]"
            : "syn-sidebar-panel is-closed -translate-x-full"
        }`}
      >
        <div className="mb-7 flex min-h-12 items-center justify-between gap-2">
          <Link
            href="/dashboard"
            onClick={dismiss}
            className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a69eff]"
          >
            <div className="syn-brand-mark relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff]">
              <span
                aria-hidden="true"
                className="dms-heartbeat absolute inset-0 bg-[radial-gradient(circle_at_32%_25%,rgba(108,99,255,0.5),transparent_70%)]"
              />
              <svg
                viewBox="0 0 24 24"
                width="23"
                height="23"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="relative"
              >
                <path d="M12 20.7S3.6 15 3.6 9.4A4.65 4.65 0 0 1 12 6.95a4.65 4.65 0 0 1 8.4 2.45c0 5.6-8.4 11.3-8.4 11.3Z" />
                <path d="M5.1 12.1h2.9l1.3-2.5 2 4.9 1.5-3.1 1.1 1.8h3" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="dms-display truncate text-[15px] font-extrabold leading-none tracking-[0.02em] text-[#e8e6f2]">
                OmniAI
              </div>
              <div className="dms-mono mt-1.5 truncate text-[8px] font-medium tracking-[0.15em] text-[#a69eff]">
                DARKMISFITSTUDIOS
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#393252] text-[#a9a2c4] transition hover:border-[#8b7fff]/50 hover:bg-[#6c63ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a69eff]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#716c8b]">
          Workspace
        </div>

        <nav aria-label="Main navigation" className="shrink-0 space-y-1">
  {navGroups.map((group) => {
    const open = foldState[group.key] ?? group.key !== "owner";
    return (
      <div key={group.key} className="mb-2">
        {group.expandable ? (
          <button
            type="button"
            onClick={() => setFoldState((s) => ({ ...s, [group.key]: !(s[group.key] ?? (group.key !== "owner")) }))}
            className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#716c8b] hover:text-[#a69eff]"
          >
            <span>{group.label}</span>
            <span aria-hidden>{open ? "▾" : "▸"}</span>
          </button>
        ) : (
          <div className="mb-1 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#716c8b]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.accent, boxShadow: `0 0 8px ${group.accent}` }} aria-hidden />
            {group.label}
          </div>
        )}
        {open && group.items.map((item) => {
          const current = item as any;
          const active = (current && current.href) === "/" ? pathname === "/" : pathname === current.href || pathname.startsWith(current.href + "/");
          return (
            <Link
              key={current.href}
              href={current.href}
              onClick={dismiss}
              aria-current={active ? "page" : undefined}
              style={{ "--nav-accent": group.accent } as React.CSSProperties}
              className={`syn-nav-item group relative flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a69eff] ${
                active
                  ? "syn-nav-item--active font-medium text-[#e8e6f2]"
                  : "border-transparent text-[#9490ac] hover:bg-[#14121f] hover:text-[#e8e6f2]"
              }`}
            >
              {active && (
                <span className="syn-nav-item__bar absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full" />
              )}
              <span className="syn-nav-item__icon flex h-6 w-6 shrink-0 items-center justify-center">
                <Icon name={current.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate">{current.label}</span>
                {current.hint && (
                  <span className={`block truncate font-mono text-[9px] uppercase tracking-[0.14em] ${
                    active ? "text-[#a69eff]/80" : "text-[#716c8b]"
                  }`}>
                    {current.hint}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    );
  })}
</nav>


        <div className="mb-3 mt-7 flex items-center justify-between px-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#716c8b]">
            Your chats
          </span>
          <span className="rounded-full border border-[#393252] px-2 py-0.5 text-[10px] text-[#9490ac]">{conversations.length}</span>
        </div>

        <div className="min-h-0 max-h-[40vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {historyError && (
            <p
              role="status"
              className="break-words rounded-lg bg-rose-500/[0.07] p-2 text-xs leading-5 text-rose-300"
            >
              {historyError}
            </p>
          )}

          {!historyError && conversations.length === 0 && (
            <p className="px-3 py-3 text-xs leading-5 text-[#716c8b]">
              Start a conversation with AI Director and your saved chats will show up here.
            </p>
          )}

          {conversations.map((conversation) => {
            const active = activeId === conversation.id;

            return (
              <Link
                key={conversation.id}
                href={`/?conversation=${encodeURIComponent(conversation.id)}`}
                onClick={() => {
                  setActiveId(conversation.id);
                  onClose();
                }}
                title={conversation.title}
                className={`group flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a69eff] ${
                  active
                    ? "border-[#6c63ff]/25 bg-[#6c63ff]/[0.12] text-[#c5bfff]"
                    : "border-transparent text-[#9490ac] hover:border-[#211d34] hover:bg-[#14121f] hover:text-[#e8e6f2]"
                }`}
              >
                <span className="shrink-0 text-[#8b7fff]" aria-hidden="true">
                  <Icon name="history" size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {conversation.title || "New chat"}
                </span>
              </Link>
            );
          })}
        </div>

{/* Director Mode toggle is now on the OmniAI chat page, where it belongs. */}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-4 d3-btn w-full justify-center gap-2 text-rose-300 border-[#3d1a24] hover:border-[#ff2a6d]/60"
          style={{ background: "linear-gradient(180deg,#2a0f18,#1a0910)" }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>⏻</span>
          Sign out
        </button>

        <div className="mt-4 border-t border-[#211d34] px-2 pt-4 text-[10px] tracking-[0.12em] text-[#716c8b]">
          DARKMISFITSTUDIOS
        </div>
      </aside>
    </>
  );
}
