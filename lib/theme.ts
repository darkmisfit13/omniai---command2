/**
 * Dark Misfit Studios — OmniAI Nexus
 * Absolute Black Cyberpunk Global Design Tokens
 * 
 * Base Canvas: Pure Shiny Black (#000000)
 * Secondary Surfaces: Obsidian-Purple (#0a071b)
 * Primary Accent: Purplish-Blue (#0C00CA)
 * Diagnostic Telemetry & Safe Zones: Baby Blue (#00ffff)
 */

export const ABSOLUTE_BLACK_CYBERPUNK = {
  // 1. APPLICATION CANVAS SURFACES (THE CORE BASE)
  canvas: {
    base: "#000000", // Pure Shiny Black root window
    deep: "#000000",
    phoneScreen: "#000000",
    pureBlack: "#000000",
  },

  // Secondary cards, chat bubbles, container panels, dropdowns, sidebar containers
  surfaces: {
    panel: "#0a071b", // Deep, rich Obsidian-Purple
    card: "#0a071b",
    cardElevated: "#110b29",
    cardHover: "#150e33",
    sidebar: "#0a071b",
    dropdown: "#0a071b",
    bubbleAi: "#0a071b",
    bubbleUser: "#0f082e",
    border: "#1f1638",
    borderSubtle: "rgba(31, 22, 56, 0.8)",
    borderGlow: "rgba(12, 0, 202, 0.45)",
  },

  // 2. PRIMARY BUTTON & NAVIGATION ACCENTS (PURPLISH-BLUE #0C00CA)
  accents: {
    primary: "#0C00CA", // Signature Purplish-Blue token line
    purplishBlue: "#0C00CA",
    electricIndigo: "#1d08e0",
    purplishBlueBright: "#3d2cf5",
    purplishBlueDark: "#090099",
    halo: "0 0 20px rgba(12, 0, 202, 0.45)",
    activeHalo: "0 0 25px rgba(12, 0, 202, 0.65), inset 0 0 10px rgba(12, 0, 202, 0.35)",
    focusRing: "0 0 0 2px rgba(12, 0, 202, 0.5), 0 0 18px rgba(12, 0, 202, 0.5)",
  },

  // 3. DIAGNOSTIC METRICS & STATUS TEXT HIGHLIGHTS (LIGHT / BABY BLUE #00FFFF)
  telemetry: {
    babyBlue: "#00ffff", // High-contrast Baby Blue / Light Blue
    lightBlue: "#00ffff",
    babyBlueGlow: "0 0 14px rgba(0, 255, 255, 0.7)",
    hazardOutline: "#00ffff",
    statusOrb: "#00ffff",
    dataTicker: "#00ffff",
    characterMatch: "#00ffff",
    streamLog: "#00ffff",
    agentStrategist: "#00ffff",
    agentEmpath: "#00ffff",
    agentGhost: "#00ffff",
    callPill: "#00ffff",
  },

  typography: {
    display: "'Syne', 'Inter', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
} as const;

export const OBSIDIAN_CYBERPUNK = ABSOLUTE_BLACK_CYBERPUNK;
export type AbsoluteBlackCyberpunkTheme = typeof ABSOLUTE_BLACK_CYBERPUNK;
export default ABSOLUTE_BLACK_CYBERPUNK;
