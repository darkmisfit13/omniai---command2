"use client";

import { useEffect } from "react";

/**
 * DepthField
 *
 * One delegated listener gives every surface marked `data-d3` a live
 * relationship with the pointer: it leans toward the cursor, and a
 * specular highlight tracks across its face. Keeping it global means
 * pages do not have to mount anything to feel like objects in space.
 *
 * `data-d3-x` / `data-d3-y` tune how far a given surface leans,
 * in degrees. Reduced-motion users get the surfaces without the lean.
 */
export default function DepthField() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function surfaceOf(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-d3]");
    }

    function onMove(event: PointerEvent) {
      const el = surfaceOf(event.target);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      const rangeX = Number(el.dataset.d3X ?? 9);
      const rangeY = Number(el.dataset.d3Y ?? 7);

      el.style.setProperty("--d3-rx", `${((0.5 - py) * rangeY * 2).toFixed(2)}deg`);
      el.style.setProperty("--d3-ry", `${((px - 0.5) * rangeX * 2).toFixed(2)}deg`);
      el.style.setProperty("--d3-mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--d3-my", `${(py * 100).toFixed(1)}%`);
    }

    function onLeave(event: PointerEvent) {
      const el = surfaceOf(event.target);
      if (!el) return;
      el.style.setProperty("--d3-rx", "0deg");
      el.style.setProperty("--d3-ry", "0deg");
    }

    // `pointerleave` does not bubble, so it has to be captured.
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave, true);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave, true);
    };
  }, []);

  return null;
}
