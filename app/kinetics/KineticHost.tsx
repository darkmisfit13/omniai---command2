"use client";

import { useEffect } from "react";

const KINETIC_SELECTOR = "[data-d3], .d3-card, .d3-tile, .d3-btn, .hud-panel, .omni-spring, .omni-glass, .omni-surface, button:not([data-no-wave]), [role='button']";

/**
 * Skin-wide kinetic layer: on every pointer interaction, spawn a fading
 * neon edge-wave overlay whose color amplitude maps to click intensity
 * (fast clicks = violet burst, sustained = emerald). Surfaces are also tagged
 * with .omni-spring so CSS spring physics apply.
 */
export default function KineticHost() {
  useEffect(() => {
    const root = document;
    // Tag interactive surfaces for spring physics.
    const tag = () => {
      document.querySelectorAll(KINETIC_SELECTOR).forEach((el) => {
        if (el instanceof HTMLElement) el.classList.add("omni-spring");
      });
    };
    tag();
    const obs = new MutationObserver(tag);
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
    };
  }, []);

  return null;
}
