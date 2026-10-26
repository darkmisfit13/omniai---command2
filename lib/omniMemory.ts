/**
 * OmniAI — Long-Term Memory Engine (shared layer)
 * ==============================================
 * A persistent, cross-thread context repository. Structural decisions made in
 * any thread (tech stacks, themes, layout guidelines, naming, project
 * parameters) become *context anchors* saved to a single global profile:
 *
 *   .omni-memory/profile.json          (filesystem mirror — dev / laptop)
 *   public.brand_memory  (Supabase)    (durable mirror — production)
 *
 * Every time a brand-new thread initialises, the stored payload is injected
 * into the model's system prompt array so Omni never forgets past context.
 *
 * This module is pure/isomorphic. Disk + database access lives in
 * `app/api/memory/route.ts`.
 */

export const MEMORY_VERSION = 2;
export const MEMORY_ENDPOINT = "/api/memory";
export const MEMORY_PROFILE_PATH = ".omni-memory/profile.json";

export type AnchorKind =
  | "project"
  | "tech-stack"
  | "theme"
  | "layout"
  | "naming"
  | "constraint"
  | "decision"
  | "preference"
  | "fact";

export type ContextAnchor = {
  id: string;
  kind: AnchorKind;
  text: string;
  source?: string;
  createdAt: string;
  /**
   * Derived by re-indexing, never authored: the id of a newer anchor that
   * overrides this one (e.g. a stack migration supersedes the old stack).
   * Superseded anchors are kept for the audit trail but never injected.
   */
  supersededBy?: string;
};

export type MemoryProfile = {
  version: number;
  updatedAt: string;
  anchors: ContextAnchor[];
};

export const ANCHOR_KINDS: AnchorKind[] = [
  "project",
  "tech-stack",
  "theme",
  "layout",
  "naming",
  "constraint",
  "decision",
  "preference",
  "fact",
];

export function emptyProfile(): MemoryProfile {
  return { version: MEMORY_VERSION, updatedAt: new Date(0).toISOString(), anchors: [] };
}

const MAX_BLOCK_ANCHORS = 80;
const MAX_ANCHOR_CHARS = 240;

function clip(text: string, max = MAX_ANCHOR_CHARS): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/* ------------------------------------------------------------------ *
 * Relevance ranking + self-healing re-index
 * ------------------------------------------------------------------ *
 * The memory layer is no longer a flat append-only log. Two derived,
 * deterministic passes keep it sharp:
 *
 *   1. RELEVANCE  — at injection time, anchors are scored against the
 *      current request (term overlap × kind weight × recency decay) so
 *      the model sees the most pertinent context first, not just the
 *      most recent.
 *   2. RE-INDEX   — when a newer anchor *revises* an older one (a stack
 *      migration, a rename, "no longer use X"), the older fragment is
 *      marked superseded. Stale code references are dropped from the
 *      payload instead of silently contradicting the new decision.
 *
 * Both passes are pure and run on read, so the result is stable no
 * matter which mirror (file or database) a profile came from.
 * ------------------------------------------------------------------ */

/** Durable structural facts outrank passing preferences. */
const KIND_WEIGHT: Record<AnchorKind, number> = {
  constraint: 3.0,
  "tech-stack": 2.6,
  project: 2.4,
  decision: 2.2,
  fact: 2.2,
  naming: 1.8,
  layout: 1.6,
  theme: 1.4,
  preference: 1.0,
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
  "our", "are", "was", "were", "will", "would", "should", "must", "have",
  "has", "had", "use", "using", "used", "make", "made", "get", "got", "new",
  "old", "all", "any", "can", "not", "but", "its", "a", "an", "of", "to",
  "in", "on", "is", "be", "as", "or", "at", "by", "we", "i", "them", "they",
  "their", "there", "here", "then", "than", "so", "if", "when", "what",
  "which", "who", "how", "why", "also", "just", "only", "very", "more",
  "most", "some", "such", "per", "via", "etc", "now", "still", "about",
  "over", "under", "between", "within", "without", "across", "after",
  "before", "instead", "it",
]);

/** Content tokens (lowercased), preserving stack-ish punctuation like next.js. */
export function tokenize(text: string): string[] {
  const matches = (text ?? "").toLowerCase().match(/[a-z0-9][a-z0-9.+_-]{2,}/g) ?? [];
  return matches.filter((token) => !STOPWORDS.has(token));
}

const RECENCY_HALF_LIFE_DAYS = 21;

function recencyFactor(createdAt: string, now: number): number {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return 0.7;
  const ageDays = Math.max(0, (now - at) / 86_400_000);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS); // 1 → fresh, →0 old
}

/** Score one anchor against the current request terms. Higher is better. */
export function scoreAnchor(
  anchor: ContextAnchor,
  queryTokens: string[],
  now: number = Date.now(),
): number {
  const anchorTokens = tokenize(anchor.text);
  const set = new Set(anchorTokens);
  let overlap = 0;
  for (const token of queryTokens) if (set.has(token)) overlap += 1;

  // Cosine-ish normalisation: rewards shared terms without rewarding verbosity.
  const similarity =
    queryTokens.length && anchorTokens.length
      ? overlap / Math.sqrt(queryTokens.length * anchorTokens.length)
      : 0;

  const base = KIND_WEIGHT[anchor.kind] ?? 1;
  const recency = 0.5 + 0.5 * recencyFactor(anchor.createdAt, now);
  return base * (1 + 3 * similarity) * recency;
}

/**
 * Rank the active (non-superseded) anchors for a request. With no query
 * terms, recency order is returned. With terms, relevance governs.
 */
export function rankAnchors(
  anchors: ContextAnchor[],
  query: string,
  limit: number = MAX_BLOCK_ANCHORS,
): ContextAnchor[] {
  const active = (anchors ?? []).filter((a) => a?.text?.trim() && !a.supersededBy);
  if (active.length === 0) return [];

  const queryTokens = tokenize(query ?? "");
  if (queryTokens.length === 0) {
    return [...active]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-limit);
  }

  const now = Date.now();
  return active
    .map((anchor) => ({ anchor, score: scoreAnchor(anchor, queryTokens, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.anchor);
}

const REVISION_RE =
  /\b(switch(?:ed|ing|es)?|migrat(?:e|ed|ing|es)?|replace[sd]?|instead of|no longer|retir(?:e|ed|ing|es)?|drop(?:ped|ping|s)?|move[sd]? to|mov(?:e|ing) to|change[sd]? to|convert(?:ed|ing)? to|now (?:use|using|on)|stop using|abandon(?:ed|ing)?|deprecat(?:e|ed|ing)|supersed(?:e|ed|ing))\b/i;

/**
 * Deterministic re-index: mark older anchors that a newer same-kind anchor
 * revises. Idempotent — derived fields are recomputed from scratch each run,
 * so it does not matter how many times it has run before.
 */
export function reindexProfile(
  profile: MemoryProfile | null | undefined,
): MemoryProfile {
  const anchors = (profile?.anchors ?? [])
    .filter((a) => a?.text?.trim())
    .map((a) => ({ ...a, supersededBy: undefined as string | undefined }));

  const ordered = [...anchors].sort(
    (a, b) => Date.parse(a.createdAt || "0") - Date.parse(b.createdAt || "0"),
  );

  for (let i = 0; i < ordered.length; i += 1) {
    const revision = ordered[i];
    if (!REVISION_RE.test(revision.text)) continue;
    const revisionTokens = new Set(tokenize(revision.text));

    for (let j = 0; j < i; j += 1) {
      const older = ordered[j];
      if (older.supersededBy) continue;
      if (older.kind !== revision.kind) continue;

      const olderTokens = new Set(tokenize(older.text));
      let shared = 0;
      for (const token of revisionTokens) if (olderTokens.has(token)) shared += 1;
      const smaller = Math.min(revisionTokens.size, olderTokens.size) || 1;

      // Same subject, changed decision → the older fragment is now stale.
      if (shared >= 1 && shared / smaller >= 0.34) older.supersededBy = revision.id;
    }
  }

  return {
    version: MEMORY_VERSION,
    updatedAt: profile?.updatedAt ?? new Date().toISOString(),
    anchors,
  };
}

/** Build the system-prompt payload for the current memory profile.
 *  When a `query` is supplied, anchors are relevance-ranked for it. */
export function memoryBlock(
  profile: MemoryProfile | null | undefined,
  query?: string,
): string {
  const reindexed = reindexProfile(profile);
  const picked = rankAnchors(reindexed.anchors, query ?? "", MAX_BLOCK_ANCHORS);
  if (picked.length === 0) return "";

  const stale = reindexed.anchors.length - reindexed.anchors.filter((a) => !a.supersededBy).length;
  const lines = picked.map((a) => `- (${a.kind}) ${clip(a.text)}`);

  return [
    "[LONG-TERM MEMORY — CROSS-THREAD CONTEXT]",
    "These are durable facts, personal details, and decisions Omni has already established with this user in earlier threads. Honour them without being asked, and keep new work consistent with them. Treat them as the user's own stated history — refer back to them naturally when relevant.",
    ...lines,
    ...(stale > 0
      ? [`(${stale} older fragment${stale === 1 ? "" : "s"} were automatically re-indexed as stale after a later decision superseded them.)`]
      : []),
    "If a stored anchor conflicts with the current request, ask which one wins before changing direction.",
    "[END LONG-TERM MEMORY]",
  ].join("\n");
}

/** Merge a newly-provided profile into an existing one, de-duplicating and
 *  re-indexing so any decision a newer anchor revises is marked stale. */
export function mergeProfile(
  base: MemoryProfile | null,
  incoming: MemoryProfile | null,
): MemoryProfile {
  const anchors: ContextAnchor[] = [];
  const seen = new Set<string>();
  for (const anchor of [...(base?.anchors ?? []), ...(incoming?.anchors ?? [])]) {
    if (!anchor?.text?.trim()) continue;
    const key = anchor.text.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    anchors.push({ ...anchor, text: clip(anchor.text) });
  }
  return reindexProfile({
    version: MEMORY_VERSION,
    updatedAt: new Date().toISOString(),
    anchors: anchors.slice(-500),
  });
}

/* ------------------------------------------------------------------ *
 * Model-authored markers
 * ------------------------------------------------------------------ */

const MARKER_RE = /\[OMNI-MEMORY::\s*([a-zA-Z-]+)\s*\|\s*([^\]]+)\]/g;

/**
 * Parse `[OMNI-MEMORY:: tech-stack | Next.js + Supabase]` markers the model
 * emits when it recognises a structural decision.
 */
export function parseMemoryMarkers(
  text: string,
  source?: string,
): ContextAnchor[] {
  const anchors: ContextAnchor[] = [];
  if (!text) return anchors;

  let match: RegExpExecArray | null;
  const re = new RegExp(MARKER_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    const rawKind = match[1].toLowerCase() as AnchorKind;
    const kind = ANCHOR_KINDS.includes(rawKind) ? rawKind : "decision";
    const body = match[2].trim();
    if (!body) continue;
    anchors.push(makeAnchor(kind, body, source));
  }
  return anchors;
}

/** Remove markers from displayed text. */
export function stripMemoryMarkers(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp(MARKER_RE.source, "g"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The instruction that teaches the model to emit memory markers. */
export function memoryMarkerInstruction(): string {
  return [
    "[MEMORY WRITE PROTOCOL]",
    "When the user states something about themselves or the project that should survive this chat — a durable personal fact, preference, or identity detail (jeans are blue, birthday, city, favorite color, name, job, an ongoing goal), or a structural decision such as a tech stack, theme, layout guideline, naming rule, project parameter, or standing constraint — append a marker on its own line at the very end of your reply, in exactly this form:",
    "[OMNI-MEMORY:: <kind> | <one-sentence fact>]",
    "<kind> is one of: fact, preference, naming, project, tech-stack, theme, layout, constraint, decision.",
    "Use `fact` for anything the user tells you about themselves (e.g. \"my jeans are blue\", \"I live in Texas\", \"my name is Dana\").",
    "Emit at most 3 markers per reply, only for durable facts and decisions, never for small talk or one-off questions. The markers are stored server-side and stripped from what the user sees.",
    "[END MEMORY WRITE PROTOCOL]",
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Deterministic fallback extraction
 * ------------------------------------------------------------------ */

function makeAnchor(kind: AnchorKind, text: string, source?: string): ContextAnchor {
  return {
    id:
      (globalThis.crypto?.randomUUID?.() ??
        `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    kind,
    text: clip(text),
    ...(source ? { source } : {}),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Statements about the user themselves. These are the facts people expect an
 * assistant to remember: personal details, preferences, and identity.
 * Deliberately broad but anchored on an explicit first-person subject or a
 * direct declarative statement about the user.
 */
const FACT_SENTENCE_RE =
  /\b(?:my|your user'?s|i am|i'?m|im|we are|i'?ve|i have|i live|i work|i like|i love|i prefer|i always|i never|i usually|i drive|i wear|i eat|i drink|my favorite|my favourite|call me|my name is|remember|my birthday|my jeans|my dog|my cat|my kid|my son|my daughter|my wife|my husband|my girlfriend|my boyfriend)\b/i;

const DECISION_VERBS =
  /\b(use|using|build with|built with|stack is|should be|must be|make it|always|never|prefer|the project is|name it|call it|rename|keep it|stick with|we'?ll use|i want)\b/i;
const STACK_TERMS =
  /\b(react|next\.?js|vue|svelte|angular|typescript|javascript|tailwind|supabase|postgres(?:ql)?|prisma|drizzle|stripe|vercel|netlify|node(?:\.js)?|python|fastapi|django|flask|deno|redis|mongodb|docker|kubernetes|ollama|openai|anthropic|gemini|groq)\b/gi;
const THEME_TERMS =
  /\b(dark|light|neon|cyberpunk|glassmorphism|minimal|retro|vaporwave|brutalist|pastel|monochrome|gradient|theme|palette|brand colou?rs?)\b/i;
const LAYOUT_TERMS =
  /\b(sidebar|dashboard|layout|grid|full[\s-]?width|responsive|hero|nav(?:igation)?|card|panel|timeline|footer|header)\b/i;

/**
 * A conservative, deterministic detector that works as a safety net so memory
 * still captures something even when the model emits no markers. It handles two
 * classes of statement:
 *
 *   1. STRUCTURAL decisions — tech stack, theme, layout (unchanged).
 *   2. PERSONAL facts and preferences — anything the user states about
 *      themselves ("my jeans are blue", "I live in Texas", "call me Dana").
 *
 * The second class is what people actually expect an assistant to remember
 * across threads, so it is deliberately captured.
 */
export function extractContextAnchors(
  text: string,
  source?: string,
): ContextAnchor[] {
  if (!text) return [];
  const anchors: ContextAnchor[] = [];
  const seen = new Set<string>();

  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 400);

  for (const sentence of sentences) {
    const key = sentence.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) continue;

    const stacks = [...sentence.matchAll(STACK_TERMS)].map((m) => m[0]);

    if (DECISION_VERBS.test(sentence)) {
      if (stacks.length > 0) {
        seen.add(key);
        anchors.push(makeAnchor("tech-stack", sentence, source));
        continue;
      } else if (THEME_TERMS.test(sentence)) {
        seen.add(key);
        anchors.push(makeAnchor("theme", sentence, source));
        continue;
      } else if (LAYOUT_TERMS.test(sentence)) {
        seen.add(key);
        anchors.push(makeAnchor("layout", sentence, source));
        continue;
      }
    }

    // Personal fact / preference fallback. Skips obvious questions and
    // imperatives so we don't store "what are my jeans" or "do this" as fact.
    if (
      FACT_SENTENCE_RE.test(sentence) &&
      !/^\s*(what|who|when|where|why|how|do|does|did|is|are|can|could|would|should|will|please)\b/i.test(
        sentence,
      )
    ) {
      seen.add(key);
      anchors.push(makeAnchor("fact", sentence, source));
    }
  }

  return anchors.slice(0, 5);
}

/* ------------------------------------------------------------------ *
 * Client helpers
 * ------------------------------------------------------------------ */

/**
 * The session token has to ride along explicitly: `/api/memory` authorizes the
 * caller with a Bearer token, and a bare browser `fetch` never carries the
 * Supabase session. Without this header every read/write 401s — which is
 * exactly why a stored profile never reached the model's system prompt.
 */
function authHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchMemoryProfile(
  signal?: AbortSignal,
  token?: string,
): Promise<MemoryProfile | null> {
  try {
    const res = await fetch(MEMORY_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      signal,
      headers: authHeaders(token),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: MemoryProfile };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export type MemoryContext = {
  profile: MemoryProfile | null;
  owner: boolean;
  role: "owner" | "standard";
};

/**
 * One round trip that returns both the long-term memory profile and the
 * caller's authorization role, so a fresh thread can build its system prompt
 * array in a single fetch.
 */
export async function fetchMemoryContext(
  signal?: AbortSignal,
  token?: string,
  query?: string,
): Promise<MemoryContext> {
  try {
    const normalizedQuery = query?.trim();
    const endpoint = normalizedQuery
      ? `${MEMORY_ENDPOINT}?query=${encodeURIComponent(normalizedQuery)}&namespace=account_memory`
      : MEMORY_ENDPOINT;
    const res = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      signal,
      headers: authHeaders(token),
    });
    if (!res.ok) return { profile: null, owner: false, role: "standard" };

    const data = (await res.json()) as {
      profile?: MemoryProfile;
      contexts?: unknown;
      owner?: boolean;
      role?: "owner" | "standard";
    };

    const retrievedAnchors: ContextAnchor[] = Array.isArray(data.contexts)
      ? data.contexts.flatMap((value): ContextAnchor[] => {
          if (!value || typeof value !== "object") return [];
          const context = value as {
            id?: unknown;
            kind?: unknown;
            text?: unknown;
            sourceThreadId?: unknown;
            createdAt?: unknown;
          };
          if (typeof context.text !== "string" || !context.text.trim()) return [];
          const kind =
            typeof context.kind === "string" &&
            ANCHOR_KINDS.includes(context.kind as AnchorKind)
              ? (context.kind as AnchorKind)
              : "fact";
          return [{
            id: typeof context.id === "string" ? context.id : makeAnchor("fact", context.text).id,
            kind,
            text: context.text,
            ...(typeof context.sourceThreadId === "string"
              ? { source: context.sourceThreadId }
              : {}),
            createdAt:
              typeof context.createdAt === "string"
                ? context.createdAt
                : new Date().toISOString(),
          }];
        })
      : [];

    const profile =
      data.profile ??
      (normalizedQuery
        ? {
            version: MEMORY_VERSION,
            updatedAt: new Date().toISOString(),
            anchors: retrievedAnchors,
          }
        : null);

    return {
      profile,
      owner: Boolean(data.owner),
      role: data.role === "owner" ? "owner" : "standard",
    };
  } catch {
    return { profile: null, owner: false, role: "standard" };
  }
}

export async function persistAnchors(
  anchors: ContextAnchor[],
  token?: string,
): Promise<boolean> {
  if (anchors.length === 0) return false;
  try {
    const res = await fetch(MEMORY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ anchors }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
