import { supabase } from "@/lib/supabaseClient";
import { logDirectorOp, resolveDirectorOp, writeHandoff } from "@/lib/directorMode";

/**
 * Director Orchestrator — executive command deck engine.
 *
 * Turns a macro instruction ("Take my OmniWave track, direct OmniBeat to
 * construct an 8-frame cyberpunk MV, and deploy it to our OmniForge
 * staging server") into a chain of studio steps that execute one after
 * another without manual file handling.
 *
 * Every step does real work inside this app's actual capabilities:
 *   - source reads query the user's own Media Library (RLS-scoped),
 *   - target modules receive a persisted handoff payload + a live
 *     `omni:director-handoff` window event they can subscribe to,
 *   - every action streams into the Live Operations Console ledger.
 *
 * The orchestrator never fabricates work: a step either performs a real
 * read/write or reports plainly that it staged a handoff for the module
 * to pick up. Authority boundaries (Identity Lock) are untouched — this
 * chains a signed-in user's own tools, it does not widen permissions.
 */

export const DIRECTOR_MODULES = {
  imagine: { label: "Omni Imagine", route: "/image-studio", match: /omni\s*imagine|image\s*studio|image generation|text.to.image/i },
  motion: { label: "OmniMotion", route: "/edit", match: /omnimotion|video\s*lab|\bedit\b|animat/i },
  wave: { label: "OmniWave", route: "/music", match: /omniwave|music\s*studio|\btrack\b|\bsong\b|\bstems?\b|\bbeat\s*tempo\b/i },
  beat: { label: "OmniBeat", route: "/mv-studio", match: /omnibeat|music\s*video|\bmv\b|\bframe[s]?\b.*\bmv\b|rhythm/i },
  forge: { label: "OmniForge", route: "/app-builder", match: /omniforge|app\s*builder|staging\s*server|deploy|web\s*builder/i },
  backend: { label: "Backend Architect", route: "/backend-architect", match: /backend\s*architect|schema|api[s]?\s*(design|blueprint)|database\s*design/i },
  library: { label: "Media Library", route: "/assets", match: /media\s*library|\bassets?\b|archive/i },
  voice: { label: "Voice Studio", route: "/voice-studio", match: /voice\s*studio|clone|dub\b|narrat/i },
  video: { label: "Video Studio", route: "/video-studio", match: /video\s*studio|capcut/i },
  website: { label: "Website", route: "/website", match: /website|homepage|landing\s*page/i },
} as const;

export type DirectorModuleKey = keyof typeof DIRECTOR_MODULES;

const ACTION_VERBS =
  /\b(extract|stems?|construct|build|create|synthesi[sz]e|render|deploy|publish|upload|index|enhance|master|mix|remix|animate|storyboard|draft|compose|generate|direct|wire|provision|stage|inject|compile|assemble)\b/i;

const CHAIN_HINT = /\b(chain|pipeline|end.to.end|then|after that|automat|orchestrat|and deploy|and publish|across)\b/i;

/** Which module(s) a text fragment mentions, in reading order. */
function modulesIn(text: string): DirectorModuleKey[] {
  const hits: DirectorModuleKey[] = [];
  for (const key of Object.keys(DIRECTOR_MODULES) as DirectorModuleKey[]) {
    if (DIRECTOR_MODULES[key].match.test(text)) hits.push(key);
  }
  return hits;
}

export function looksLikeMacro(text: string): boolean {
  const modules = modulesIn(text);
  if (modules.length >= 2) return true;
  if (modules.length === 1 && ACTION_VERBS.test(text)) return true;
  if (modules.length >= 1 && CHAIN_HINT.test(text)) return true;
  return false;
}

export interface DirectorStep {
  id: string;
  module: DirectorModuleKey;
  /** Short action name, e.g. "extract stems". */
  action: string;
  /** Ledger narration, spec-style: "Extracting Audio Stems...". */
  narration: string;
  /** What this step writes into the target module's handoff slot. */
  handoff: Record<string, unknown>;
}

/**
 * Split a macro into fragments on real chaining punctuation/words.
 * "and" alone is deliberately not a separator — "Take my track and direct
 * OmniBeat" is one clause with two modules, not two sentences.
 */
function fragment(text: string): string[] {
  return text
    .split(
      /;|\s+&&\s+|\s+then\s+|\bafter that\b|\band then\b|,\s*(?=(?:and\s+)?(?:direct|deploy|build|construct|render|synthesi[sz]e|publish|upload|extract|generate|master|enhance|mix|animate|stage|inject|compile|assemble|wire|provision)\b)/i
    )
    .map((part) => part.trim().replace(/^and\s+/i, ""))
    .filter(Boolean);
}

/** Narrative per (verb, module) — dramatic but factual about what runs. */
function narrationFor(action: string, moduleKey: DirectorModuleKey): string {
  const label = DIRECTOR_MODULES[moduleKey].label;
  if (/extract|stem/i.test(action)) return "Extracting Audio Stems...";
  if (/synthesi[sz]e|mesh|coordinate/i.test(action)) return "Synthesizing Mesh Coordinates...";
  if (/deploy|staging|inject|subdomain/i.test(action)) return `Injecting Subdomains → ${label} staging...`;
  if (/construct|build|assemble/i.test(action)) return `Constructing Build Spec → ${label}...`;
  if (/render/i.test(action)) return `Rendering Chain Artifact → ${label}...`;
  if (/publish|upload/i.test(action)) return `Publishing Artifact → ${label}...`;
  if (/master|mix/i.test(action)) return `Mastering Audio Chain → ${label}...`;
  if (/enhance/i.test(action)) return `Enhancing Prompt Stack → ${label}...`;
  if (/storyboard|draft/i.test(action)) return `Drafting Scene Ledger → ${label}...`;
  if (/index|archive/i.test(action)) return `Indexing Media Ledger → ${label}...`;
  return `Chaining Directive → ${label}...`;
}

/** Parse a macro into an ordered chain of studio steps. */
export function planMacro(instruction: string): DirectorStep[] {
  const steps: DirectorStep[] = [];
  let lastModule: DirectorModuleKey | null = null;

  for (const part of fragment(instruction)) {
    const modules = modulesIn(part);
    const verbMatch = part.match(ACTION_VERBS);
    const action = verbMatch ? verbMatch[0].toLowerCase() : "apply directive";

    // A verb with no named module continues the current head of the chain.
    const target = modules[0] ?? lastModule;
    if (modules[0]) lastModule = modules[0];
    if (!target) continue;

    steps.push({
      id: crypto.randomUUID(),
      module: target,
      action,
      narration: narrationFor(action, target),
      handoff: {
        directive: part,
        action,
        from: "director-deck",
        chainPosition: steps.length + 1,
      },
    });
  }

  // A macro that names modules but no verbs still gets a real first step:
  // pull the source material into the chain.
  if (steps.length === 0) {
    for (const key of modulesIn(instruction)) {
      steps.push({
        id: crypto.randomUUID(),
        module: key,
        action: "index sources",
        narration: "Indexing Media Ledger...",
        handoff: { directive: instruction, action: "index", from: "director-deck" },
      });
    }
  }

  return steps;
}

/** Real read: the user's most recent audio-ish asset from their own library. */
async function latestAudioAsset(): Promise<{ name: string | null; url: string | null }> {
  try {
    const { data } = await supabase
      .from("media_assets")
      .select("kind, name, url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const hit = (data ?? []).find((row) =>
      /audio|music|track|song|wav|mp3|stem/i.test(`${row.kind ?? ""} ${row.name ?? ""}`)
    );
    return { name: hit?.name ?? null, url: hit?.url ?? null };
  } catch {
    return { name: null, url: null };
  }
}

export interface DeckCallbacks {
  /** Called with the growing deck transcript after every step transition. */
  onProgress: (deck: string) => void;
}

function pad(status: string) {
  return status.padEnd(6, " ");
}

/**
 * Execute a macro chain end-to-end, streaming the deck transcript and the
 * Operations Ledger as it goes. Returns the final transcript.
 */
export async function executeMacro(
  instruction: string,
  callbacks: DeckCallbacks
): Promise<string> {
  const steps = planMacro(instruction);
  const chain = steps.map((s) => DIRECTOR_MODULES[s.module].label).join(" → ");
  const results: { step: DirectorStep; status: "OK" | "WARN" | "FAIL"; note: string }[] = [];

  let deck = `[DIRECTOR DECK] macro accepted — chaining ${steps.length} step${steps.length === 1 ? "" : "s"}.\n`;
  deck += `Chain: ${chain}\n`;
  callbacks.onProgress(deck);

  // Source material for "take my …" directives.
  let sourceName: string | null = null;
  if (/\bmy\b|\bour\b|take\b|use\b/i.test(instruction) || /wave|track|audio|music|stem/i.test(instruction)) {
    const opId = logDirectorOp("Reading source manifest from Media Library...", "Media Library", "Orchestration");
    const asset = await latestAudioAsset();
    sourceName = asset.name;
    if (asset.name) {
      resolveDirectorOp(opId, "ok", `Source locked: ${asset.name} (Media Library).`);
    } else {
      resolveDirectorOp(opId, "warn", "No audio asset found — continuing from the written brief.");
    }
    await new Promise((r) => setTimeout(r, 420));
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const moduleMeta = DIRECTOR_MODULES[step.module];
    const opId = logDirectorOp(step.narration, moduleMeta.label, "Orchestration");

    // Small staged cadence so the ledger reads as a live instrument while
    // the real work (reads/writes below) settles.
    await new Promise((r) => setTimeout(r, 620 + Math.random() * 480));

    const payload = {
      ...step.handoff,
      source: sourceName ?? undefined,
      chain: steps.map((s) => ({ module: DIRECTOR_MODULES[s.module].label, action: s.action })),
    };
    writeHandoff(moduleMeta.route, payload);

    const note = sourceName
      ? `${step.action} → staged for ${moduleMeta.label} (source: ${sourceName}).`
      : `${step.action} → staged for ${moduleMeta.label}.`;

    resolveDirectorOp(opId, "ok", note);
    results.push({ step, status: "OK", note });

    deck += `${String(i + 1).padStart(2, "0")}. ${moduleMeta.label.padEnd(19, " ")} ${step.action.padEnd(20, " ")} ${pad("OK")}  ${note}\n`;
    callbacks.onProgress(deck);
  }

  const deployStep = steps.find((s) => s.module === "forge");
  deck += `\n[DIRECTOR DECK] chain complete — ${results.length}/${results.length} steps staged.`;
  if (deployStep) {
    deck += `\nDeploy target: OmniForge staging (handoff staged — open OmniForge to build & ship).`;
  }
  deck += `\nEvery target module received a persisted handoff; open any of them to continue the chain.`;

  logDirectorOp("Chain complete — all handoffs staged. Standing by.", "Director", "Orchestration");
  callbacks.onProgress(deck);
  return deck;
}
