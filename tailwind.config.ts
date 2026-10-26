import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0B0A14",
        ink: "#E8E6F2",
        wine: "#6C63FF",
        ash: "#9490AC",
        signal: "#8B7FFF",
        hud: {
          bg: "#0b0a14",
          panel: "#14121f",
          border: "#211d34",
          ink: "#e8e6f2",
          muted: "#9490ac",
          accent: "#6c63ff",
          bright: "#8b7fff",
          stream: "#00f2fe",
          ok: "#00ffa3",
          warn: "#ff2a6d",
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
