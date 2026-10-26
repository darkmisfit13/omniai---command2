"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useMediaVault } from "@/lib/mediaVault";
import { supabase } from "@/lib/supabaseClient";

export type StudioRole = "owner" | "creator" | "guest";
export interface StudioUser {
  id: string | null;
  email: string | null;
  displayName: string | null;
  role: StudioRole;
}

interface StudioContextValue {
  user: StudioUser;
  credits: number | null;
  vaultAssets: ReturnType<typeof useMediaVault>;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  refreshUser: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  spendCredits: (n: number, reason?: string) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const vaultAssets = useMediaVault();
  const [user, setUser] = useState<StudioUser>({ id: null, email: null, displayName: null, role: "guest" });
  const [credits, setCredits] = useState<number | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) { setUser({ id: null, email: null, displayName: null, role: "guest" }); return; }
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const named = [meta.display_name, meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim().length > 0);
      const ownerId = process.env.NEXT_PUBLIC_OMNIAI_OWNER_ID || process.env.OMNIAI_OWNER_ID;
      setUser({ id: u.id, email: u.email ?? null, displayName: named ? named.trim() : ((u.email ?? "").split("@")[0] || null), role: ownerId && u.id === ownerId ? "owner" : "creator" });
    } catch {
      setUser({ id: null, email: null, displayName: null, role: "guest" });
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    // Credits are reserved for the ledger service; this stays nullable until wired.
    setCredits(null);
  }, []);

  const spendCredits = useCallback((n: number, _reason?: string) => {
    setCredits(prev => (prev === null ? prev : Math.max(0, prev - Math.max(0, n))));
  }, []);

  useEffect(() => {
    refreshUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void refreshUser(); });
    return () => subscription.unsubscribe();
  }, [refreshUser]);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value: StudioContextValue = { user, credits, vaultAssets, theme, setTheme, refreshUser, refreshCredits, spendCredits };
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    // Fallback so components never crash when used outside the provider.
    return {
      user: { id: null, email: null, displayName: null, role: "guest" },
      credits: null,
      vaultAssets: [],
      theme: "dark",
      setTheme: () => {},
      refreshUser: async () => {},
      refreshCredits: async () => {},
      spendCredits: () => {},
    };
  }
  return ctx;
}
