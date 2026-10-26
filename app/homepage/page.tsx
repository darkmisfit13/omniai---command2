"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { BOOSTER_PACKS } from "@/lib/billing/boosters";
import { GROUP_LABELS, PLANS } from "@/lib/billing/creditTable";
import { startCheckout } from "@/lib/billing/checkoutClient";
import { intentPath, type PurchaseIntent } from "@/lib/billing/purchaseIntent";
import MatrixField from "./MatrixField";

/**
 * /homepage — the landing surface of the OmniAI matrix.
 *
 * Three layers, in order:
 *   01  a WebGL hero banner (MatrixField) carrying the sovereign headline and
 *       the sign-up action,
 *   02  the full studio cluster — every module in the workspace, grouped into
 *       categorical blocks with per-studio accent framing and a micro-glitch
 *       on hover,
 *   03  the pricing deck — the four primary plans and the credit booster
 *       packs in one balanced flex-row array of glassmorphic columns.
 *
 * Plan names, prices and credit numbers come from lib/billing/creditTable, so
 * this page can never advertise a figure the API would not charge.
 */

type Studio = {
  code: string;
  name: string;
  href: string;
  accent: string;
  summary: string;
};

type StudioBlock = {
  index: string;
  key: string;
  title: string;
  accent: string;
  caption: string;
  grid: string;
  studios: Studio[];
};

const BLOCKS: StudioBlock[] = [
  {
    index: "01",
    key: "media",
    title: "Media Creation Suite",
    accent: "#e879f9",
    caption:
      "Render engines for image, motion, sound and space. Every output registers to the Global Media Link Vault the moment it is ready.",
    grid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
    studios: [
      {
        code: "M-01",
        name: "Omni Imagine",
        href: "/image-studio",
        accent: "#e879f9",
        summary:
          "Text-to-image synthesis with standard, HD and premium tiers, seeded runs and vault-native exports.",
      },
      {
        code: "M-02",
        name: "OmniMotion",
        href: "/edit",
        accent: "#8b7fff",
        summary:
          "Multi-track timeline editing: AI cuts, transitions, auto-captions and 720p through 4K export.",
      },
      {
        code: "M-03",
        name: "OmniWave",
        href: "/music",
        accent: "#00f2fe",
        summary:
          "Full-song generation from 10 to 180 seconds with lyrics AI, style presets and a scrubbing transport.",
      },
      {
        code: "M-04",
        name: "OmniBeat",
        href: "/mv-studio",
        accent: "#6ee7b7",
        summary:
          "Audio-synced music-video agent with waveform analysis and an AI director storyboard matrix.",
      },
      {
        code: "M-05",
        name: "Voice Studio",
        href: "/voice-studio",
        accent: "#ffb84d",
        summary:
          "Voice cloning, dubbing and metered voiceover rendering with published character caps.",
      },
      {
        code: "M-06",
        name: "Spatial 3D",
        href: "/spatial-3d",
        accent: "#4facfe",
        summary:
          "3D scene assembly and spatial composition with drop-in assets from the media vault.",
      },
    ],
  },
  {
    index: "02",
    key: "code",
    title: "Coding & Architecture",
    accent: "#6ee7b7",
    caption:
      "The build half of the matrix: scaffold, schema, interface and integration — shipped with self-healing tests and auto-provisioned SSL.",
    grid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
    studios: [
      {
        code: "C-01",
        name: "OmniForge",
        href: "/app-builder",
        accent: "#6ee7b7",
        summary:
          "Prompt to scaffold to self-healing tests to edge-network deploy, with SSL auto-provisioned.",
      },
      {
        code: "C-02",
        name: "Backend Architect",
        href: "/backend-architect",
        accent: "#00f2fe",
        summary:
          "Schema design, service boundaries and API surfaces drafted as reviewable blueprints.",
      },
      {
        code: "C-03",
        name: "Cosmic UI Lab",
        href: "/ui-lab",
        accent: "#e879f9",
        summary:
          "Generative component library with live preview states and vault-backed media slots.",
      },
      {
        code: "C-04",
        name: "API Connector Hub",
        href: "/api-connector",
        accent: "#fcd34d",
        summary:
          "REST and webhook bindings for external services, with signed request inspection.",
      },
    ],
  },
  {
    index: "03",
    key: "pipeline",
    title: "Pipeline Operations",
    accent: "#8b7fff",
    caption:
      "The connective tissue: briefs, vectors, simulations, identity work, prompts and the automation layer that moves all of it without downloads.",
    grid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
    studios: [
      {
        code: "P-01",
        name: "Storyboard Supervisor",
        href: "/storyboard",
        accent: "#8b7fff",
        summary:
          "Breaks a script into scenes, shots and handoffs that feed every downstream studio.",
      },
      {
        code: "P-02",
        name: "Vector Lab",
        href: "/vector-graphics",
        accent: "#e879f9",
        summary:
          "Recraft geometry — marks, logos and brand assets exported as clean SVG.",
      },
      {
        code: "P-03",
        name: "Viral Mockup",
        href: "/viral-mockup",
        accent: "#fb7185",
        summary:
          "Social feed simulator for placement, framing and engagement previews before you post.",
      },
      {
        code: "P-04",
        name: "Face-Swap",
        href: "/face-swap",
        accent: "#ffb84d",
        summary:
          "Identity and costume refiner for character work, stills and motion frames.",
      },
      {
        code: "P-05",
        name: "Prompt Studio",
        href: "/prompts",
        accent: "#6ee7b7",
        summary:
          "Prompt enhancement library with reusable standing instructions across the matrix.",
      },
      {
        code: "P-06",
        name: "Connectors",
        href: "/integrations",
        accent: "#00f2fe",
        summary:
          "External app links kept in sync with the matrix, with live status on every route.",
      },
      {
        code: "P-07",
        name: "Automations",
        href: "/automations",
        accent: "#fcd34d",
        summary:
          "Multi-step AI workflows that chain studios on a trigger and log every handoff.",
      },
    ],
  },
];

const PLAN_ACCENT: Record<string, string> = {
  free: "#6ee7b7",
  creator: "#8b7fff",
  pro: "#e879f9",
  business: "#00f2fe",
};

type Booster = {
  id: string;
  credits: number;
  priceUsd: number;
  tag: string;
};

/**
 * The booster shelf below is sourced from the same catalog the checkout and
 * webhook use (lib/billing/boosters.ts) — a hardcoded list here drifted into
 * advertising packs and prices ($10/500, $25/1500, $75/5000) that did not
 * exist. Names, credits and prices now match what Stripe actually charges.
 */
const BOOSTERS: Booster[] = BOOSTER_PACKS.map((pack) => ({
  id: pack.id,
  credits: pack.credits,
  priceUsd: pack.priceUsd,
  tag: pack.name,
}));

/** Assets a credit balance covers, priced straight from the credit table. */
function assetMetrics(credits: number) {
  return [
    { label: "HD images", value: Math.floor(credits / 20) },
    { label: "Voiceovers", value: Math.floor(credits / 10) },
    { label: "Music tracks", value: Math.floor(credits / 40) },
  ];
}

const CREDIT_GROUPS = Object.keys(GROUP_LABELS).length;

export default function WelcomePage() {
  const router = useRouter();
  const [buying, setBuying] = useState<string | null>(null);
  const [buyError, setBuyError] = useState("");
  const inFlight = useRef(false);

  // Every paid plan card and every booster card runs its own purchase. A
  // signed-out visitor is sent to sign in with the choice preserved in the
  // URL; a signed-in one goes straight to that product's checkout.
  const buy = useCallback(
    async (intent: PurchaseIntent) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const key = intent.kind === "plan" ? `plan:${intent.tier}` : `pack:${intent.id}`;
      setBuying(key);
      setBuyError("");

      const result = await startCheckout(intent);

      if (result.status === "auth") {
        // Release the click lock before navigating so a blocked/interrupted
        // client transition never leaves the plan cards permanently disabled.
        inFlight.current = false;
        setBuying(null);
        router.push(`/login?next=${encodeURIComponent(intentPath(intent))}`);
        return;
      }
      if (result.status === "redirect") {
        window.location.href = result.url;
        return;
      }
      inFlight.current = false;
      setBuying(null);
      setBuyError(result.message);
    },
    [router]
  );

  return (
    <div className="landing-matrix mx-auto w-full min-w-0 max-w-[1560px] space-y-9 px-1 py-3 sm:px-0 sm:py-4">
      <style jsx global>{`
        .landing-matrix {
          position: relative;
        }

        .landing-matrix .matrix-kicker {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--hud-muted);
        }

        .landing-matrix .matrix-kicker i {
          font-style: normal;
          color: #4a4270;
          margin: 0 0.5rem;
        }

        /* ---------------- 01 — 3D MATRIX HERO ---------------- */

        .landing-matrix .matrix-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: clamp(430px, 60vh, 640px);
          padding: clamp(2.25rem, 5vw, 4.5rem) clamp(1.25rem, 4vw, 3.5rem);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          background:
            radial-gradient(120% 130% at 50% 0%, #0d0a1f 0%, #07060f 58%, #050409 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            inset 0 -20px 60px rgba(108, 99, 255, 0.07),
            0 34px 70px -46px #000;
        }

        .landing-matrix .matrix-field {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          -webkit-mask-image: radial-gradient(
            135% 105% at 50% 45%,
            #000 42%,
            rgba(0, 0, 0, 0.35) 78%,
            transparent 96%
          );
          mask-image: radial-gradient(
            135% 105% at 50% 45%,
            #000 42%,
            rgba(0, 0, 0, 0.35) 78%,
            transparent 96%
          );
        }

        .landing-matrix .matrix-hero__veil {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(64% 58% at 50% 44%, rgba(6, 5, 12, 0.12), rgba(5, 4, 9, 0.74) 80%),
            linear-gradient(
              180deg,
              rgba(5, 4, 10, 0.6),
              transparent 28%,
              transparent 62%,
              rgba(5, 4, 10, 0.8)
            );
        }

        .landing-matrix .matrix-hero__content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 62rem;
        }

        .landing-matrix .matrix-hero__frame {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.4rem 0.85rem;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          background: rgba(11, 10, 20, 0.62);
          backdrop-filter: blur(10px);
        }

        .landing-matrix .matrix-hero__frame span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6ee7b7;
          box-shadow: 0 0 10px #6ee7b7;
        }

        .landing-matrix .matrix-hero__title {
          margin-top: 1.15rem;
          font-family: "Syne", "Inter", sans-serif;
          font-weight: 800;
          font-size: clamp(2.05rem, 5.4vw, 4.15rem);
          line-height: 1.04;
          letter-spacing: -0.04em;
          color: #f7f5ff;
          text-shadow: 0 16px 60px rgba(108, 99, 255, 0.5), 0 2px 12px rgba(108, 99, 255, 0.25);
        }

        .landing-matrix .matrix-hero__title em {
          font-style: normal;
          background: linear-gradient(100deg, #a69eff 0%, #e879f9 48%, #6ee7b7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .landing-matrix .matrix-hero__lede {
          margin-top: 1.1rem;
          max-width: 46rem;
          font-size: 0.95rem;
          line-height: 1.75;
          color: #b7b0c9;
        }

        .landing-matrix .matrix-hero__actions {
          margin-top: 2rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.85rem;
        }

        .landing-matrix .matrix-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.95rem 1.7rem;
          border: 1px solid rgba(255, 255, 255, 0.42);
          border-radius: 14px;
          background: linear-gradient(135deg, #8b7fff 0%, #6c63ff 44%, #e879f9 100%);
          color: #fff;
          font-size: 0.84rem;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          box-shadow:
            0 0 0 1px rgba(108, 99, 255, 0.55),
            0 20px 46px -18px rgba(108, 99, 255, 0.95),
            0 0 74px -18px rgba(232, 121, 249, 0.9);
          transition:
            transform 180ms ease,
            filter 180ms ease,
            box-shadow 220ms ease;
        }

        .landing-matrix .matrix-cta:hover {
          color: #fff;
          filter: brightness(1.12);
          transform: translateY(-2px);
          box-shadow:
            0 0 0 1px rgba(180, 170, 255, 0.85),
            0 26px 56px -18px rgba(108, 99, 255, 1),
            0 0 96px -14px rgba(232, 121, 249, 1);
        }

        .landing-matrix .matrix-cta:active {
          transform: translateY(0);
        }

        .landing-matrix .matrix-ghost {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.95rem 1.4rem;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 14px;
          background: rgba(15, 13, 26, 0.66);
          backdrop-filter: blur(12px);
          color: #c5bdff;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            color 180ms ease,
            transform 180ms ease;
        }

        .landing-matrix .matrix-ghost:hover {
          color: #f4f1ff;
          border-color: #8b7fff;
          background: rgba(108, 99, 255, 0.16);
          transform: translateY(-2px);
        }

        .landing-matrix .matrix-hero__stats {
          margin-top: 2.1rem;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
          padding: 0;
          list-style: none;
        }

        .landing-matrix .matrix-hero__stats li {
          padding: 0.4rem 0.85rem;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 999px;
          background: rgba(11, 10, 20, 0.6);
          backdrop-filter: blur(8px);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
          color: #c6bfe4;
        }

        .landing-matrix .matrix-hero__stats b {
          color: #6ee7b7;
          font-weight: 700;
        }

        /* ---------------- section chrome ---------------- */

        .landing-matrix .matrix-section {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .landing-matrix .matrix-section__head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem 1.5rem;
          padding: 1.1rem 1.25rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: linear-gradient(
            140deg,
            rgba(26, 22, 44, 0.8) 0%,
            rgba(14, 12, 24, 0.74) 100%
          );
          backdrop-filter: blur(14px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055);
        }

        .landing-matrix .matrix-section__title {
          margin-top: 0.5rem;
          font-family: "Syne", "Inter", sans-serif;
          font-size: clamp(1.3rem, 2.2vw, 1.95rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #f4f1ff;
        }

        .landing-matrix .matrix-section__sub {
          margin-top: 0.5rem;
          max-width: 72ch;
          font-size: 0.8rem;
          line-height: 1.7;
          color: #a49dc0;
        }

        .landing-matrix .matrix-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .landing-matrix .matrix-legend span {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.35rem 0.7rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          background: rgba(11, 10, 20, 0.6);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.14em;
          color: #c9c2e4;
        }

        .landing-matrix .matrix-legend i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--chip);
          box-shadow: 0 0 10px var(--chip);
        }

        /* ---------------- 02 — studio cluster ---------------- */

        .landing-matrix .matrix-block {
          position: relative;
          overflow: hidden;
          padding: 1.1rem;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 18px;
          background: linear-gradient(
            180deg,
            rgba(21, 18, 36, 0.68) 0%,
            rgba(10, 9, 18, 0.74) 100%
          );
          backdrop-filter: blur(12px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .landing-matrix .matrix-block::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            var(--cat) 0%,
            rgba(255, 255, 255, 0.16) 46%,
            transparent 100%
          );
        }

        .landing-matrix .matrix-block__head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem 0.9rem;
          padding-bottom: 0.9rem;
          margin-bottom: 0.95rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .landing-matrix .matrix-block__index {
          padding: 0.22rem 0.55rem;
          border: 1px solid var(--cat);
          border-radius: 7px;
          color: var(--cat);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
        }

        .landing-matrix .matrix-block__title {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 1.06rem;
          font-weight: 700;
          color: #f2efff;
        }

        .landing-matrix .matrix-block__count {
          margin-left: auto;
          padding: 0.22rem 0.7rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: #8d86ad;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
        }

        .landing-matrix .matrix-block__caption {
          flex-basis: 100%;
          max-width: 88ch;
          font-size: 0.76rem;
          line-height: 1.65;
          color: #a49dc0;
        }

        /* studio node — the hover card */

        .landing-matrix .studio-node {
          position: relative;
          display: block;
          overflow: hidden;
          min-width: 0;
          padding: 0.95rem 1rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 14px;
          background: linear-gradient(165deg, rgba(28, 24, 46, 0.86), rgba(13, 11, 22, 0.92));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.055),
            0 12px 26px -20px rgba(0, 0, 0, 0.95);
          transition:
            border-color 200ms ease,
            box-shadow 240ms ease,
            background 240ms ease;
        }

        .landing-matrix .studio-node:hover,
        .landing-matrix .studio-node:focus-visible {
          border-color: var(--accent);
          background: linear-gradient(165deg, rgba(34, 29, 56, 0.9), rgba(15, 13, 26, 0.94));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.09),
            0 16px 36px -20px var(--accent),
            inset 0 0 26px -16px var(--accent);
        }

        .landing-matrix .studio-node__glow {
          position: absolute;
          right: -22%;
          bottom: -58%;
          width: 72%;
          aspect-ratio: 1;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.14;
          filter: blur(46px);
          transform: scale(0.82);
          transition:
            opacity 260ms ease,
            transform 300ms cubic-bezier(0.2, 0.7, 0.3, 1);
          pointer-events: none;
        }

        .landing-matrix .studio-node:hover .studio-node__glow {
          opacity: 0.42;
          transform: scale(1.06);
        }

        .landing-matrix .studio-node__scan {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          background: repeating-linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.07) 0 1px,
            transparent 1px 4px
          );
        }

        .landing-matrix .studio-node__body {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          min-width: 0;
        }

        .landing-matrix .studio-node__top {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .landing-matrix .studio-node__code {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 9.5px;
          letter-spacing: 0.2em;
          color: var(--accent);
          opacity: 0.85;
        }

        .landing-matrix .studio-node__led {
          margin-left: auto;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
          opacity: 0.55;
          transition: opacity 200ms ease;
        }

        .landing-matrix .studio-node:hover .studio-node__led {
          opacity: 1;
        }

        .landing-matrix .studio-node__name {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 0.99rem;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: #f4f1ff;
        }

        .landing-matrix .studio-node__summary {
          font-size: 0.73rem;
          line-height: 1.6;
          color: #a9a2c6;
        }

        .landing-matrix .studio-node__cta {
          margin-top: 0.35rem;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 9.5px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #7d76a0;
          transition: color 200ms ease;
        }

        .landing-matrix .studio-node:hover .studio-node__cta {
          color: var(--accent);
        }

        .landing-matrix .studio-node--index {
          border-style: dashed;
          background: rgba(11, 10, 20, 0.5);
          display: flex;
          align-items: center;
          text-align: left;
        }

        .landing-matrix .studio-node--index .studio-node__name {
          font-size: 0.9rem;
        }

        /* micro-glitch — armed on hover, runs once per entry */

        .landing-matrix .studio-node:hover .studio-node__body,
        .landing-matrix .studio-node:focus-visible .studio-node__body {
          animation: studio-node-jitter 0.36s steps(4, end) 1 both;
        }

        .landing-matrix .studio-node:hover .studio-node__name,
        .landing-matrix .studio-node:focus-visible .studio-node__name {
          animation: studio-node-split 0.42s steps(3, end) 1 both;
        }

        .landing-matrix .studio-node:hover .studio-node__scan,
        .landing-matrix .studio-node:focus-visible .studio-node__scan {
          animation: studio-node-scan 0.5s ease-out 1 both;
        }

        @keyframes studio-node-jitter {
          0% {
            transform: translate3d(0, 0, 0);
          }
          25% {
            transform: translate3d(-3px, 1px, 0);
          }
          50% {
            transform: translate3d(3px, -1px, 0);
          }
          75% {
            transform: translate3d(-2px, -2px, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes studio-node-split {
          0% {
            text-shadow: none;
            transform: translateX(0);
          }
          30% {
            text-shadow:
              -2px 0 var(--accent),
              2px 0 rgba(232, 121, 249, 0.85);
            transform: translateX(-2px);
          }
          60% {
            text-shadow:
              2px 0 var(--accent),
              -2px 0 rgba(0, 242, 254, 0.8);
            transform: translateX(2px);
          }
          100% {
            text-shadow: 0 0 14px -4px var(--accent);
            transform: translateX(0);
          }
        }

        @keyframes studio-node-scan {
          0% {
            opacity: 0.9;
            transform: translateY(-5%);
          }
          100% {
            opacity: 0;
            transform: translateY(5%);
          }
        }

        /* ---------------- 03 — pricing deck ---------------- */

        .landing-matrix .pricing-deck {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        .landing-matrix .pricing-deck__row {
          display: flex;
          flex-flow: row wrap;
          align-items: stretch;
          gap: 0.75rem;
        }

        .landing-matrix .pricing-deck__divider {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 1rem;
          padding-top: 0.85rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .landing-matrix .pricing-deck__divider strong {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 0.92rem;
          font-weight: 700;
          color: #f4f1ff;
        }

        .landing-matrix .pricing-deck__divider em {
          font-style: normal;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
          color: #8d86ad;
        }

        .landing-matrix .glass-card {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: linear-gradient(
            160deg,
            rgba(27, 23, 45, 0.72) 0%,
            rgba(16, 14, 27, 0.78) 58%,
            rgba(10, 9, 18, 0.82) 100%
          );
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.5),
            0 20px 44px -30px rgba(0, 0, 0, 0.95);
          transition:
            transform 240ms cubic-bezier(0.2, 0.7, 0.3, 1),
            border-color 220ms ease,
            box-shadow 240ms ease;
        }

        .landing-matrix .glass-card:hover {
          transform: translateY(-4px);
          border-color: var(--card-accent, #6c63ff);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.09),
            0 30px 54px -30px var(--card-accent, #6c63ff);
        }

        .landing-matrix .plan-card {
          flex: 1 1 240px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          padding: 1.1rem;
        }

        .landing-matrix .booster-card {
          flex: 1 1 220px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding: 1.1rem;
        }

        .landing-matrix .plan-card--featured {
          border-color: rgba(232, 121, 249, 0.5);
          background: linear-gradient(
            160deg,
            rgba(46, 27, 60, 0.76) 0%,
            rgba(20, 15, 32, 0.8) 58%,
            rgba(11, 9, 20, 0.84) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 26px 54px -30px rgba(232, 121, 249, 0.75);
        }

        .landing-matrix .plan-card__head,
        .landing-matrix .booster-card__head {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .landing-matrix .plan-card__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--card-accent);
          box-shadow: 0 0 10px var(--card-accent);
          flex-shrink: 0;
        }

        .landing-matrix .plan-card__name {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 1.02rem;
          font-weight: 700;
          color: #f4f1ff;
        }

        .landing-matrix .plan-card__flag {
          margin-left: auto;
          padding: 0.18rem 0.55rem;
          border: 1px solid var(--card-accent);
          border-radius: 999px;
          color: var(--card-accent);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .landing-matrix .plan-card__price {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 1.95rem;
          font-weight: 800;
          letter-spacing: -0.035em;
          color: #f7f5ff;
          line-height: 1;
        }

        .landing-matrix .plan-card__price span {
          margin-left: 0.3rem;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.66rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          color: #8d86ad;
        }

        .landing-matrix .plan-card__blurb {
          font-size: 0.74rem;
          line-height: 1.55;
          color: #a49dc0;
        }

        .landing-matrix .credit-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          align-self: flex-start;
          padding: 0.42rem 0.7rem;
          border: 1px solid var(--card-accent, #6c63ff);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.035);
          box-shadow: inset 0 0 22px -14px var(--card-accent, #6c63ff);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          color: #f2efff;
        }

        .landing-matrix .credit-badge b {
          color: var(--card-accent, #6c63ff);
          font-weight: 700;
        }

        .landing-matrix .asset-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .landing-matrix .asset-metric {
          padding: 0.45rem 0.3rem;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 9px;
          background: rgba(9, 8, 16, 0.55);
          text-align: center;
          min-width: 0;
        }

        .landing-matrix .asset-metric b {
          display: block;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--card-accent, #6c63ff);
          font-variant-numeric: tabular-nums;
        }

        .landing-matrix .asset-metric span {
          display: block;
          margin-top: 0.15rem;
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8d86ad;
          line-height: 1.3;
        }

        .landing-matrix .plan-card__features {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.42rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .landing-matrix .plan-card__features li {
          display: flex;
          gap: 0.5rem;
          font-size: 0.75rem;
          line-height: 1.5;
          color: #b6aed4;
        }

        .landing-matrix .plan-card__features li::before {
          content: "\\203A";
          color: var(--card-accent);
          font-weight: 800;
          flex-shrink: 0;
        }

        .landing-matrix .plan-card__cta,
        .landing-matrix .booster-card__cta {
          display: block;
          width: 100%;
          margin-top: auto;
          padding: 0.62rem 0.9rem;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: #e9e5ff;
          text-align: center;
          font-family: inherit;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          cursor: pointer;
          appearance: none;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            color 180ms ease,
            box-shadow 200ms ease;
        }

        .landing-matrix .plan-card__cta:disabled,
        .landing-matrix .booster-card__cta:disabled {
          opacity: 0.55;
          cursor: progress;
        }

        .landing-matrix .plan-card__cta:hover,
        .landing-matrix .booster-card__cta:hover {
          color: #fff;
          border-color: var(--card-accent);
          background: rgba(255, 255, 255, 0.075);
          box-shadow: 0 0 26px -12px var(--card-accent);
        }

        .landing-matrix .plan-card__cta--primary {
          border-color: rgba(255, 255, 255, 0.35);
          background: linear-gradient(135deg, #7a70ff 0%, #6c63ff 52%, #e879f9 100%);
          color: #fff;
          box-shadow: 0 16px 32px -18px rgba(108, 99, 255, 0.95);
        }

        .landing-matrix .plan-card__cta--primary:hover {
          color: #fff;
          filter: brightness(1.1);
          border-color: #fff;
          box-shadow: 0 20px 40px -18px rgba(232, 121, 249, 0.95);
        }

        .landing-matrix .booster-card__price {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 1.55rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #f7f5ff;
          line-height: 1;
        }

        .landing-matrix .booster-card__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .landing-matrix .booster-card__meta span {
          padding: 0.25rem 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 7px;
          background: rgba(9, 8, 16, 0.5);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          color: #a8a1c8;
        }

        .landing-matrix .booster-card__tag {
          font-size: 0.73rem;
          color: #a49dc0;
          line-height: 1.55;
        }

        /* ---------------- footer ---------------- */

        .landing-matrix .landing-footer {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }

        .landing-matrix .landing-footer__panel {
          padding: 1.05rem 1.15rem;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 16px;
          background: linear-gradient(
            150deg,
            rgba(24, 20, 40, 0.74),
            rgba(12, 10, 21, 0.78)
          );
          backdrop-filter: blur(12px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .landing-matrix .landing-footer__title {
          font-family: "Syne", "Inter", sans-serif;
          font-size: 0.94rem;
          font-weight: 700;
          color: #f4f1ff;
          margin-bottom: 0.6rem;
        }

        .landing-matrix .landing-footer__list {
          display: flex;
          flex-direction: column;
          gap: 0.42rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .landing-matrix .landing-footer__list li {
          position: relative;
          padding-left: 0.9rem;
          font-size: 0.74rem;
          line-height: 1.6;
          color: #a49dc0;
        }

        .landing-matrix .landing-footer__list li::before {
          content: "\\2022";
          position: absolute;
          left: 0;
          color: #6ee7b7;
        }

        .landing-matrix .landing-footer__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          margin-top: 0.85rem;
        }

        .landing-matrix .landing-footer__link {
          padding: 0.5rem 0.85rem;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.035);
          color: #c5bdff;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          transition:
            border-color 180ms ease,
            color 180ms ease,
            background 180ms ease;
        }

        .landing-matrix .landing-footer__link:hover {
          color: #fff;
          border-color: #8b7fff;
          background: rgba(108, 99, 255, 0.16);
        }

        .landing-matrix .landing-footer__link--primary {
          border-color: rgba(139, 127, 255, 0.6);
          background: rgba(108, 99, 255, 0.18);
          color: #e6e1ff;
        }

        .landing-matrix .landing-colophon {
          padding: 0.85rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(9, 8, 16, 0.6);
          text-align: center;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
          color: #7d76a0;
        }

        /* ---------------- entrance ---------------- */

        @keyframes matrix-rise {
          from {
            opacity: 0;
            transform: translateY(26px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .landing-matrix .matrix-rise {
          animation: matrix-rise 0.8s cubic-bezier(0.2, 0.7, 0.3, 1) both;
        }

        .landing-matrix .matrix-rise--2 {
          animation-delay: 0.12s;
        }

        .landing-matrix .matrix-rise--3 {
          animation-delay: 0.24s;
        }

        .landing-matrix .matrix-rise--4 {
          animation-delay: 0.34s;
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-matrix .matrix-rise,
          .landing-matrix .studio-node:hover .studio-node__body,
          .landing-matrix .studio-node:hover .studio-node__name,
          .landing-matrix .studio-node:focus-visible .studio-node__body,
          .landing-matrix .studio-node:focus-visible .studio-node__name {
            animation: none !important;
          }

          .landing-matrix .glass-card:hover,
          .landing-matrix .matrix-cta:hover,
          .landing-matrix .matrix-ghost:hover {
            transform: none;
          }
        }
      `}</style>

      {/* ============ 01 — DYNAMIC 3D MATRIX HERO BANNER ============ */}
      <section
        className="matrix-hero"
        aria-labelledby="matrix-hero-title"
        data-d3="3"
        data-d3-x="3"
        data-d3-y="2"
      >
        <MatrixField />
        <div className="matrix-hero__veil" aria-hidden="true" />

        <div className="matrix-hero__content">
          <p className="matrix-hero__frame matrix-kicker matrix-rise">
            <span aria-hidden="true" />
            OMNIAI<i>/</i>DEEP SPACE CANVAS 01
          </p>

          <h1
            id="matrix-hero-title"
            className="matrix-hero__title matrix-rise matrix-rise--2"
          >
            OmniAI: The Sovereign <em>Creative Matrix.</em>
          </h1>

          <p className="matrix-hero__lede matrix-rise matrix-rise--2">
            Seventeen specialised studios — media, architecture and pipeline —
            wired into one WebGL-deep workspace, one Global Media Link Vault and
            a single credit ledger. Generate in any module, hand the result to
            the next, ship without a download.
          </p>

          <div className="matrix-hero__actions matrix-rise matrix-rise--3">
            <a className="matrix-cta" href="/login?signup=1">
              Initialize Studio Framework
              <span aria-hidden="true">→</span>
            </a>
            <a className="matrix-ghost" href="/pricing">
              Inspect pricing deck
            </a>
          </div>

          <ul className="matrix-hero__stats matrix-rise matrix-rise--4">
            <li>
              <b>17</b> STUDIOS
            </li>
            <li>
              <b>3</b> CLUSTERS
            </li>
            <li>
              <b>{CREDIT_GROUPS}</b> CREDIT GROUPS
            </li>
            <li>
              <b>LOCAL + CLOUD</b> RUNTIME
            </li>
          </ul>
        </div>
      </section>

      {/* ============ 02 — THE 17-STUDIO INTERACTIVE CLUSTER ============ */}
      <section className="matrix-section" aria-labelledby="cluster-title">
        <header className="matrix-section__head" data-d3="4" data-d3-x="4" data-d3-y="4">
          <div>
            <p className="matrix-kicker">
              02<i>/</i>STUDIO CLUSTER
            </p>
            <h2 id="cluster-title" className="matrix-section__title">
              The 17-Studio Interactive Cluster
            </h2>
            <p className="matrix-section__sub">
              Every module in the workspace, grouped into categorical blocks.
              Hover any node to arm its micro-glitch — the frame locks to that
              studio&apos;s accent and the module launches straight into the
              workspace shell.
            </p>
          </div>

          <div className="matrix-legend">
            {BLOCKS.map((block) => (
              <span key={block.key} style={{ "--chip": block.accent } as CSSProperties}>
                <i aria-hidden="true" />
                {block.title.toUpperCase()}
              </span>
            ))}
          </div>
        </header>

        {BLOCKS.map((block) => (
          <article
            key={block.key}
            className="matrix-block"
            style={{ "--cat": block.accent } as CSSProperties}
          >
            <header className="matrix-block__head">
              <span className="matrix-block__index">{block.index}</span>
              <h3 className="matrix-block__title">{block.title}</h3>
              <span className="matrix-block__count">
                {block.studios.length} MODULES
              </span>
              <p className="matrix-block__caption">{block.caption}</p>
            </header>

            <div className={block.grid}>
              {block.studios.map((studio) => (
                <a
                  key={studio.code}
                  href={studio.href}
                  className="studio-node"
                  style={{ "--accent": studio.accent } as CSSProperties}
                  data-d3="6"
                  data-d3-x="5"
                  data-d3-y="4"
                >
                  <span className="studio-node__glow" aria-hidden="true" />
                  <span className="studio-node__scan" aria-hidden="true" />
                  <div className="studio-node__body">
                    <div className="studio-node__top">
                      <span className="studio-node__code">{studio.code}</span>
                      <span className="studio-node__led" aria-hidden="true" />
                    </div>
                    <h4 className="studio-node__name">{studio.name}</h4>
                    <p className="studio-node__summary">{studio.summary}</p>
                    <span className="studio-node__cta">
                      Launch module <span aria-hidden="true">&#8599;</span>
                    </span>
                  </div>
                </a>
              ))}

              {/* Pipeline Operations lists seven modules, which leaves one
                  cell open in the four-column grid on a wide screen. The
                  index strip completes the row and leads to the console. */}
              {block.key === "pipeline" && (
                <a
                  href="/dashboard"
                  className="studio-node studio-node--index"
                  style={{ "--accent": "#a69eff" } as CSSProperties}
                >
                  <div className="studio-node__body">
                    <span className="studio-node__code">IDX</span>
                    <h4 className="studio-node__name">Open the workspace index</h4>
                    <p className="studio-node__summary">
                      All seventeen modules, the Global Media Link Vault and
                      your credit wallet, on one console.
                    </p>
                    <span className="studio-node__cta">
                      Go to dashboard <span aria-hidden="true">&#8599;</span>
                    </span>
                  </div>
                </a>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* ============ 03 — PERFECTLY ALIGNED GRID PRICING DECK ============ */}
      <section className="matrix-section" aria-labelledby="pricing-title">
        <header className="matrix-section__head" data-d3="4" data-d3-x="4" data-d3-y="4">
          <div>
            <p className="matrix-kicker">
              03<i>/</i>PRICING DECK
            </p>
            <h2 id="pricing-title" className="matrix-section__title">
              Perfectly Aligned Grid Pricing Deck
            </h2>
            <p className="matrix-section__sub">
              Four primary plans and four credit boosters in one balanced
              flex-row array. Credit badges, asset tracking metrics and feature
              lists all sit inside the same thin-border frame — and every number
              below is read from the billing credit table the API charges
              against.
            </p>
          </div>

          <div className="matrix-legend">
            <span style={{ "--chip": "#6ee7b7" } as CSSProperties}>
              <i aria-hidden="true" />4 PRIMARY PLANS
            </span>
            <span style={{ "--chip": "#e879f9" } as CSSProperties}>
              <i aria-hidden="true" />4 BOOSTER PACKS
            </span>
          </div>
        </header>

        {buyError && (
          <p
            role="alert"
            style={{ color: "#ffb3c1", fontSize: "0.85rem", marginTop: "0.75rem", textAlign: "center" }}
          >
            {buyError}
          </p>
        )}

        <div className="pricing-deck">
          <div className="pricing-deck__row">
            {PLANS.map((plan) => {
              const accent = PLAN_ACCENT[plan.tier] ?? "#6c63ff";
              const featured = plan.tier === "pro";
              const signup = plan.tier === "free";

              return (
                <article
                  key={plan.tier}
                  className={`glass-card plan-card${featured ? " plan-card--featured" : ""}`}
                  style={{ "--card-accent": accent } as CSSProperties}
                >
                  <div className="plan-card__head">
                    <span className="plan-card__dot" aria-hidden="true" />
                    <h3 className="plan-card__name">{plan.name}</h3>
                    {featured && <span className="plan-card__flag">Popular</span>}
                  </div>

                  <p className="plan-card__price">
                    {plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`}
                    {plan.priceUsd > 0 && <span>/ MONTH</span>}
                  </p>

                  <p className="plan-card__blurb">{plan.blurb}</p>

                  <span className="credit-badge">
                    <b>&#10022;</b>
                    {plan.monthlyCredits.toLocaleString()} CR / MO
                  </span>

                  <div className="asset-metrics">
                    {assetMetrics(plan.monthlyCredits).map((metric) => (
                      <div key={metric.label} className="asset-metric">
                        <b>{metric.value.toLocaleString()}</b>
                        <span>{metric.label}</span>
                      </div>
                    ))}
                  </div>

                  <ul className="plan-card__features">
                    {plan.highlights
                      .filter((line) => !/credits\s*\/\s*month/i.test(line))
                      .map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                  </ul>

                  {signup ? (
                    <a
                      className={`plan-card__cta${featured ? " plan-card__cta--primary" : ""}`}
                      href="/login?signup=1&next=%2Fpricing"
                    >
                      Start on Omni Free
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={`plan-card__cta${featured ? " plan-card__cta--primary" : ""}`}
                      onClick={() => void buy({ kind: "plan", tier: plan.tier })}
                      disabled={buying !== null}
                    >
                      {buying === `plan:${plan.tier}`
                        ? "Opening checkout…"
                        : `Deploy with ${plan.name}`}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <div className="pricing-deck__divider">
            <strong>Credit Booster Packs</strong>
            <em>NEVER EXPIRE · STACK ON ANY PLAN · NO SUBSCRIPTION</em>
          </div>

          <div className="pricing-deck__row">
            {BOOSTERS.map((pack) => {
              const perCredit = (pack.priceUsd / pack.credits).toFixed(3);
              const images = Math.floor(pack.credits / 20);

              return (
                <article
                  key={pack.id}
                  className="glass-card booster-card"
                  style={{ "--card-accent": "#e879f9" } as CSSProperties}
                >
                  <div className="booster-card__head">
                    <span className="plan-card__dot" aria-hidden="true" />
                    <h3 className="plan-card__name">{pack.tag}</h3>
                  </div>

                  <span className="credit-badge">
                    <b>&#10022;</b>
                    {pack.credits.toLocaleString()} CREDITS
                  </span>

                  <p className="booster-card__price">${pack.priceUsd}</p>

                  <div className="booster-card__meta">
                    <span>${perCredit} / CREDIT</span>
                    <span>≈ {images} HD IMAGES</span>
                  </div>

                  <p className="booster-card__tag">
                    A one-time top-up that sits on top of your monthly
                    allowance and is spent only after the plan credits run out.
                  </p>

                  <button
                    type="button"
                    className="booster-card__cta"
                    onClick={() => void buy({ kind: "pack", id: pack.id })}
                    disabled={buying !== null}
                  >
                    {buying === `pack:${pack.id}` ? "Opening checkout…" : "Buy credits"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FOOTER — ACCESS + LEGAL FRAMEWORK ============ */}
      <footer className="landing-footer">
        <div className="landing-footer__panel">
          <h2 className="landing-footer__title">Privacy &amp; Legal Framework</h2>
          <ul className="landing-footer__list">
            <li>
              Codebases, model weights, inputs and generations stay inside your
              execution loop.
            </li>
            <li>
              Nothing you generate or upload is cached or used for external
              model training.
            </li>
            <li>
              Credentials and Stripe billing are encrypted at rest; no
              third-party sees private content.
            </li>
            <li>
              Role-based isolation keeps every tenant&apos;s assets in their own
              vault.
            </li>
          </ul>
          <div className="landing-footer__actions">
            <a className="landing-footer__link" href="/privacy">
              Privacy notice
            </a>
            <a className="landing-footer__link" href="/terms">
              Terms of use
            </a>
          </div>
        </div>

        <div className="landing-footer__panel">
          <h2 className="landing-footer__title">Account Creation Gateway</h2>
          <ul className="landing-footer__list">
            <li>
              Verified email plus an optional second factor before the workspace
              unlocks.
            </li>
            <li>
              Free tier starts with 100 credits a month — no card required.
            </li>
            <li>
              Credits are charged per action and every failed generation is
              refunded automatically.
            </li>
          </ul>
          <div className="landing-footer__actions">
            <a className="landing-footer__link landing-footer__link--primary" href="/login?signup=1">
              Create account
            </a>
            <a className="landing-footer__link" href="/login">
              Sign in instead
            </a>
            <a className="landing-footer__link" href="/pricing">
              Full credit table
            </a>
          </div>
        </div>
      </footer>

      <p className="landing-colophon">
        © 2026 DARKMISFITSTUDIOS · OMNIAI · SOVEREIGN CREATIVE MATRIX
      </p>
    </div>
  );
}
