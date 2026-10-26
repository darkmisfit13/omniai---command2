"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeHudActivity,
  type HudActivityEvent,
  type HudActivityMode,
} from "./hudActivity";

export function useHudActivity() {
  const [sources, setSources] = useState<Record<string, HudActivityEvent>>({});

  useEffect(() => subscribeHudActivity((event) => {
    setSources((previous) => ({ ...previous, [event.source]: event }));
  }), []);

  return useMemo(() => {
    const values = Object.values(sources);
    const intensity = values.reduce(
      (highest, event) => Math.max(highest, event.intensity),
      0,
    );
    const leader = [...values].sort((a, b) => b.intensity - a.intensity)[0];
    const mode: HudActivityMode =
      intensity > 0.12 && leader ? leader.mode : "idle";

    return {
      intensity,
      mode,
      active: intensity > 0.12,
    };
  }, [sources]);
}
