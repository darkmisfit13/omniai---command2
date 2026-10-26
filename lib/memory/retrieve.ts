import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorizeUser,
  isUserSession,
} from "@/lib/generation/serverAuth";
import {
  scoreAnchor,
  tokenize,
  type AnchorKind,
} from "@/lib/omniMemory";

export const MEMORY_NAMESPACES = [
  "platform_knowledge",
  "account_memory",
] as const;

export type MemoryNamespace = (typeof MEMORY_NAMESPACES)[number];

export type RetrievedMemoryContext = {
  id: string;
  namespace: MemoryNamespace;
  text: string;
  kind: AnchorKind;
  sourceThreadId: string | null;
  version: number;
  createdAt: string;
  score: number;
};

export type MemoryLookup =
  | { threadId: string; query?: never; namespace?: MemoryNamespace }
  | { query: string; threadId?: never; namespace?: MemoryNamespace };

export type MemoryRetrievalResult = {
  contexts: RetrievedMemoryContext[];
  namespace: MemoryNamespace;
  lookup: { kind: "thread"; threadId: string } | { kind: "query"; query: string };
};

type BrandMemoryRow = {
  id: string;
  content: string;
  namespace: MemoryNamespace;
  source_thread_id: string | null;
  version: number;
  created_at: string;
};

type StoredAnchor = {
  id?: unknown;
  kind?: unknown;
  text?: unknown;
  source?: unknown;
  sourceThreadId?: unknown;
  namespace?: unknown;
  version?: unknown;
  createdAt?: unknown;
};

const MAX_QUERY_LENGTH = 500;
const MAX_THREAD_ID_LENGTH = 128;
const MAX_CANDIDATES = 80;
const MAX_RESULTS = 12;
const MAX_CONTEXT_CHARS = 1200;
const ENVELOPE_KEY = "__omni_memory";
const VALID_KINDS = new Set<AnchorKind>([
  "project",
  "tech-stack",
  "theme",
  "layout",
  "naming",
  "constraint",
  "decision",
  "preference",
  "fact",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function searchTerms(query: string): string[] {
  return tokenize(query).slice(0, 16);
}

function parseRow(row: BrandMemoryRow): RetrievedMemoryContext | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.content);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed[ENVELOPE_KEY] !== "anchor") return null;
  const anchor = parsed as StoredAnchor;
  if (typeof anchor.text !== "string" || !anchor.text.trim()) return null;

  const kind =
    typeof anchor.kind === "string" && VALID_KINDS.has(anchor.kind as AnchorKind)
      ? (anchor.kind as AnchorKind)
      : "fact";
  const sourceThreadId =
    row.source_thread_id ??
    (typeof anchor.sourceThreadId === "string"
      ? anchor.sourceThreadId
      : typeof anchor.source === "string"
        ? anchor.source
        : null);
  const createdAt =
    typeof anchor.createdAt === "string" && Number.isFinite(Date.parse(anchor.createdAt))
      ? anchor.createdAt
      : row.created_at;
  const id = typeof anchor.id === "string" ? anchor.id : row.id;

  return {
    id,
    namespace: row.namespace,
    text: anchor.text.replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT_CHARS),
    kind,
    sourceThreadId,
    version: row.version,
    createdAt,
    score: 0,
  };
}

function rankContexts(
  contexts: RetrievedMemoryContext[],
  query: string | null
): RetrievedMemoryContext[] {
  if (query) {
    const terms = searchTerms(query);
    return contexts
      .map((context) => ({
        ...context,
        score: scoreAnchor(
          {
            id: context.id,
            kind: context.kind,
            text: context.text,
            source: context.sourceThreadId ?? undefined,
            createdAt: context.createdAt,
          },
          terms
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RESULTS);
  }

  return [...contexts]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, MAX_RESULTS)
    .map((context, index) => ({ ...context, score: MAX_RESULTS - index }));
}

function queryMemory(
  client: SupabaseClient,
  userId: string,
  namespace: MemoryNamespace
) {
  let query = client
    .from("brand_memory")
    .select("id,content,namespace,source_thread_id,version,created_at")
    .eq("namespace", namespace);

  // Platform knowledge is shared read-only and protected by its dedicated
  // authenticated SELECT RLS policy. Account memory remains tenant-scoped.
  if (namespace === "account_memory") {
    query = query.eq("owner_id", userId);
  }

  return query;
}

/**
 * Retrieve a small, ranked context set from the indexed Supabase memory table.
 * The Request must contain a bearer token; authorizeUser validates it with
 * Supabase and all reads use the resulting JWT-bound client and RLS policies.
 */
export async function retrieveMemory(
  request: Request,
  lookup: MemoryLookup
): Promise<MemoryRetrievalResult | Response> {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const namespace = lookup.namespace ?? "account_memory";
  const requestedThreadId =
    typeof lookup.threadId === "string" ? lookup.threadId : null;
  const requestedQuery =
    typeof lookup.query === "string" ? lookup.query : null;

  if ((requestedThreadId === null) === (requestedQuery === null)) {
    return Response.json(
      { error: "Provide exactly one of threadId or query." },
      { status: 400 }
    );
  }

  if (requestedThreadId !== null) {
    const threadId = requestedThreadId.trim();
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(threadId) ||
      threadId.length > MAX_THREAD_ID_LENGTH
    ) {
      return Response.json({ error: "The threadId is invalid." }, { status: 400 });
    }

    const { data, error } = await queryMemory(
      session.client,
      session.userId,
      namespace
    )
      .eq("source_thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(MAX_CANDIDATES);

    if (error) {
      return Response.json({ error: "Memory retrieval failed." }, { status: 500 });
    }

    const contexts = (data ?? [])
      .map((row) => parseRow(row as BrandMemoryRow))
      .filter((context): context is RetrievedMemoryContext => context !== null);

    return {
      contexts: rankContexts(contexts, null),
      namespace,
      lookup: { kind: "thread", threadId },
    };
  }

  const query = normalizeQuery(requestedQuery ?? "");
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { error: `The query must contain 1 to ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const terms = searchTerms(query);
  if (terms.length === 0) {
    return {
      contexts: [],
      namespace,
      lookup: { kind: "query", query },
    };
  }

  // Tokenize before handing the search expression to Postgres. The generated
  // tsvector GIN index bounds candidates; ranking is then computed on that set.
  const searchExpression = terms.join(" OR ");
  const { data, error } = await queryMemory(
    session.client,
    session.userId,
    namespace
  )
    .textSearch("content_search", searchExpression, {
      config: "english",
      type: "websearch",
    })
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (error) {
    return Response.json({ error: "Memory retrieval failed." }, { status: 500 });
  }

  const contexts = (data ?? [])
    .map((row) => parseRow(row as BrandMemoryRow))
    .filter((context): context is RetrievedMemoryContext => context !== null);

  return {
    contexts: rankContexts(contexts, query),
    namespace,
    lookup: { kind: "query", query },
  };
}
