"use client";

import type { ReactNode } from "react";

export interface MicroModuleSkeletonProps {
  label?: string;
  accent?: string;
  className?: string;
  children?: ReactNode;
}

export function MicroModuleSkeleton({ label = "micro-frontend module", accent = "#8b7fff", className }: MicroModuleSkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={`micro-module-skeleton ${className ?? ""}`.trim()}
      style={{
        minHeight: 240,
        borderRadius: 24,
        border: `1px solid ${accent}44`,
        background: "radial-gradient(circle at top, rgba(108,99,255,0.12), rgba(11,10,20,0.82) 62%)",
        boxShadow: `0 0 80px ${accent}22, inset 0 0 30px rgba(0,0,0,0.22)`,
        padding: 20,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes microModuleShimmer {
          0% { transform: translateX(-100%); opacity: 0.35; }
          50% { opacity: 0.9; }
          100% { transform: translateX(100%); opacity: 0.35; }
        }
        .micro-module-skeleton::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 0%, ${accent}55 48%, transparent 100%);
          animation: microModuleShimmer 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12 }}>
        <div style={{ width: 140, height: 12, borderRadius: 999, background: `${accent}66`, boxShadow: `0 0 24px ${accent}55` }} />
        <div style={{ width: "58%", height: 26, borderRadius: 12, background: "rgba(255,255,255,0.08)" }} />
        <div style={{ width: "86%", height: 12, borderRadius: 999, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ width: "72%", height: 12, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[0, 1, 2].map((item) => (
            <div key={item} style={{ height: 72, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
          ))}
        </div>
        <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, opacity: 0.85 }}>
          Loading {label}
        </span>
      </div>
    </section>
  );
}

export function DynamicRouteMatrixSkeleton(props: MicroModuleSkeletonProps) {
  return <MicroModuleSkeleton {...props} />;
}

export const NeonVioletSkeletonCard = MicroModuleSkeleton;