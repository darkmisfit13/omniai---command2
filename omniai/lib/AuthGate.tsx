"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    // Subscribe before checking the current session so auth changes
    // are not missed during initialization.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (session) {
        setChecked(true);
      } else if (pathname !== "/login") {
        setChecked(false);
        router.replace("/login");
      } else {
        setChecked(true);
      }
    });

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error || !data.session) {
          if (pathname !== "/login") {
            setChecked(false);
            router.replace("/login");
            return;
          }

          setChecked(true);
          return;
        }

        setChecked(true);
      } catch {
        if (!active) return;

        if (pathname !== "/login") {
          setChecked(false);
          router.replace("/login");
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
  }, [pathname, router]);

  // Do not mount protected pages or the conversation sidebar until
  // a session has been confirmed.
  if (!checked) return null;

  return <>{children}</>;
}
