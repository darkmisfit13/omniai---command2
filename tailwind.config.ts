import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        canvas: "#000000",
        black: "#000000",
        obsidian: "#0a071b",
        "obsidian-purple": "#0a071b",
        ink: "#F1F0F7",
        wine: "#0C00CA",
        ash: "#8D87A8",
        signal: "#0C00CA",
        accent: "#0C00CA",
        neon: "#00ffff",
        "baby-blue": "#00ffff",
        "light-blue": "#00ffff",
        "neon-green": "#00ffff",
        hud: {
          bg: "#000000",
          panel: "#0a071b",
          border: "#1f1638",
          ink: "#f1f0f7",
          muted: "#8d87a8",
          accent: "#0C00CA",
          bright: "#3d2cf5",
          stream: "#00ffff",
          ok: "#00ffff",
          warn: "#ff2a6d",
          neon: "#00ffff",
        },
      },
      fontFamily: {
        display: ["Syne", "Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
