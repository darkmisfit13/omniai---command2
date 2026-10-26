"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function loginPathFor(pathname: string): string {
  const destination = pathname + (typeof window === "undefined" ? "" : window.location.search);
  return `/login?next=${encodeURIComponent(destination)}`;
}

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // TEMPORARY LOCAL PREVIEW BYPASS - revert before commit.
  const preview = process.env.NEXT_PUBLIC_OMNIAI_PREVIEW_BYPASS === "1";

  // Routes that are allowed to render without a session. /homepage is the
  // public landing surface: its primary action is the sign-up sheet, so a
  // signed-out visitor has to be able to reach it — same treatment /login has
  // always had. Everything else stays behind the gate.
  const PUBLIC_ROUTES = new Set(["/login", "/homepage"]);

  // A session is not fully signed-in while the account has a verified second
  // factor but the session is still only AAL1 (password alone). Without this
  // check a stolen password would browse the whole app after signing in.
  // (Runs locally off the JWT — no network round trip.)
  async function hasUnfinishedSecondFactor(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !data) return false;
      return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
    } catch {
      return false;
    }
  }

  async function enforceSecondFactor(path: string): Promise<void> {
    // On the public routes a half-signed-in session is an asset, not a
    // threat: the page resumes straight at the code prompt using it.
    if (PUBLIC_ROUTES.has(path) || !(await hasUnfinishedSecondFactor())) {
      setChecked(true);
      return;
    }
    setChecked(false);
    router.replace(loginPathFor(path));
    // Deferred: signing out from inside the auth callback can deadlock the
    // auth lock. The login page then resumes straight at the code prompt.
    setTimeout(() => { void supabase.auth.signOut(); }, 0);
  }

  useEffect(() => {
    if (preview) {
      setChecked(true);
      return;
    }
    let active = true;

    // Subscribe before checking the current session so auth changes
    // are not missed during initialization.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (session) {
        void enforceSecondFactor(pathname);
      } else if (!PUBLIC_ROUTES.has(pathname)) {
        setChecked(false);
        router.replace(loginPathFor(pathname));
      } else {
        setChecked(true);
      }
    });

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error || !data.session) {
          if (!PUBLIC_ROUTES.has(pathname)) {
            setChecked(false);
            router.replace(loginPathFor(pathname));
            return;
          }

          setChecked(true);
          return;
        }

        await enforceSecondFactor(pathname);
      } catch {
        if (!active) return;

        if (!PUBLIC_ROUTES.has(pathname)) {
          setChecked(false);
          router.replace(loginPathFor(pathname));
          return;
        }

        setChecked(true);
      }
    }

    void checkSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router]);

  // Do not mount protected pages or the conversation sidebar until
  // a session has been confirmed.
  if (!checked) return null;

  return <>{children}</>;
}
