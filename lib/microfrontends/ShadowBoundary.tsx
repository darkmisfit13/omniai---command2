"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ShadowBoundaryProps {
  children: ReactNode;
  className?: string;
  title?: string;
  mode?: "open" | "closed";
}

function cloneDocumentStyles(target: ShadowRoot) {
  if (target.querySelector("[data-microfrontend-styles]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-microfrontend-styles", "true");
  let css = ":host { display: block; contain: layout style paint; }";
  const sheets = Array.from(document.styleSheets ?? []);
  for (const sheet of sheets) {
    try {
      const rules = Array.from(sheet.cssRules ?? []);
      for (const rule of rules) css += `\n${rule.cssText}`;
    } catch {
      // Cross-origin stylesheets cannot be read; skip them rather than aborting.
    }
  }
  style.textContent = css;
  target.appendChild(style);
}

export function ShadowBoundary({ children, className, title, mode = "open" }: ShadowBoundaryProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof host.attachShadow !== "function") return;
    let shadow = host.shadowRoot;
    if (!shadow) shadow = host.attachShadow({ mode });
    if (!shadow.querySelector("[data-microfrontend-styles]")) cloneDocumentStyles(shadow);
    if (title) host.setAttribute("aria-label", title);
    setRoot(shadow);
  }, [mode, title]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-microfrontend-sandbox="true"
      data-microfrontend-shadow={mode}
      style={{ display: "block", minWidth: 0, width: "100%", height: "100%", minHeight: 0 }}
    >
      {root ? createPortal(children, root) : children}
    </div>
  );
}

export const ShadowDOMBoundary = ShadowBoundary;
export const ShadowDOMSandbox = ShadowBoundary;
export const IsolatedShadowContainer = ShadowBoundary;
export const StudioShadowBoundary = ShadowBoundary;