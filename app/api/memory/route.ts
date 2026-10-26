import { promises as fs } from "node:fs";
import path from "node:path";
import {
  authorizeUser,
  isUserSession,
  json,
} from "@/lib/generation/serverAuth";
import {
  retrieveMemory,
  type MemoryNamespace,
} from "@/lib/memory/retrieve";
import {
  MEMORY_PROFILE_PATH,
  MEMORY_VERSION,
  type ContextAnchor,
  type MemoryProfile,
  emptyProfile,
  mergeProfile,
} from "@/lib/omniMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_PATH = path.join(process.cwd(), MEMORY_PROFILE_PATH);
const ENVELOPE = "__omni_memory";
const MAX_ANCHORS_PER_WRITE = 25;
const MAX_ANCHOR_CHARS = 240;
const MAX_SOURCE_THREAD_ID_LENGTH = 128;

type MemoryRequestBody = {
  anchors?: unknown;
  threadId?: unknown;
  query?: unknown;
  namespace?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNamespace(value: unknown): MemoryNamespace | null {
  if (value === undefined || value === null || value === "") {
    return "account_memory";
  }
  if (value === "account_memory" || value === "platform_knowledge") {
    return value;
  }
  return null;
}

function isAnchor(value: unknown): value is ContextAnchor {
  if (!isRecord(value)) return false;
  return typeof value.text === "string" && value.text.trim().length > 0;
}

async function readFileProfile(): Promise<MemoryProfile | null> {
  try {
    const raw = await fs.readFile(PROFILE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.anchors)) return null;

    const anchors = parsed.anchors.filter(isAnchor);
    return {
      version: MEMORY_VERSION,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(0).toISOString(),
      anchors,
    };
  } catch {
    return null;
  }
}

async function writeFileProfile(profile: MemoryProfile): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(PROFILE_PATH), { recursive: true });
    const temporary = `${PROFILE_PATH}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(profile, null, 2), "utf8");
    await fs.rename(temporary, PROFILE_PATH);
    return true;
  } catch {
    // Serverless filesystems can be read-only; Supabase remains the durable store.
    return false;
  }
}

async function returnRetrievedContexts(
  request: Request,
  lookup: {
    threadId?: string;
    query?: string;
    namespace: MemoryNamespace;
  }
) {
  if (lookup.threadId !== undefined && lookup.query !== undefined) {
    return json({ error: "Provide either threadId or query, not both." }, 400);
  }

  if (lookup.threadId === undefined && lookup.query === undefined) {
    return json({ error: "A threadId or query is required for retrieval." }, 400);
  }

  const result =
    lookup.threadId !== undefined
      ? await retrieveMemory(request, {
          threadId: lookup.threadId,
          namespace: lookup.namespace,
        })
      : await retrieveMemory(request, {
          query: lookup.query as string,
          namespace: lookup.namespace,
        });

  if (result instanceof Response) return result;
  return json({ contexts: result.contexts });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId") ?? undefined;
  const query = url.searchParams.get("query") ?? undefined;
  const namespaceValue = url.searchParams.get("namespace") ?? undefined;

  if (namespaceValue !== undefined && parseNamespace(namespaceValue) === null) {
    return json({ error: "namespace must be account_memory or platform_knowledge." }, 400);
  }

  const namespace = parseNamespace(namespaceValue) ?? "account_memory";
  if (threadId !== undefined || query !== undefined) {
    return returnRetrievedContexts(request, { threadId, query, namespace });
  }

  if (namespaceValue !== undefined) {
    return json({ error: "A threadId or query is required for retrieval." }, 400);
  }

  // Startup calls use this response to obtain the caller's role only. Memory
  // content is fetched later, using the current request as a targeted query.
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  return json({
    profile: emptyProfile(),
    contexts: [],
    owner: session.isOwner,
    role: session.isOwner ? "owner" : "standard",
  });
}

export async function POST(request: Request) {
  const bodyValue: unknown = await request.json().catch(() => null);
  if (!isRecord(bodyValue)) {
    return json(
      { error: "Send a JSON object with anchors, or a threadId/query lookup." },
      400
    );
  }
  const body = bodyValue as MemoryRequestBody;
  const namespace = parseNamespace(body.namespace);
  if (namespace === null) {
    return json({ error: "namespace must be account_memory or platform_knowledge." }, 400);
  }

  const hasThreadId = typeof body.threadId === "string";
  const hasQuery = typeof body.query === "string";
  if (hasThreadId || hasQuery) {
    return returnRetrievedContexts(request, {
      ...(hasThreadId ? { threadId: body.threadId as string } : {}),
      ...(hasQuery ? { query: body.query as string } : {}),
      namespace,
    });
  }

  if (namespace !== "account_memory") {
    return json({ error: "platform_knowledge is read-only through this endpoint." }, 403);
  }

  if (!Array.isArray(body.anchors)) {
    return json({ error: "Expected an anchors array." }, 400);
  }

  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const incoming: ContextAnchor[] = body.anchors
    .filter(isAnchor)
    .slice(0, MAX_ANCHORS_PER_WRITE)
    .map((anchor) => ({
      id:
        typeof anchor.id === "string"
          ? anchor.id
          : crypto.randomUUID(),
      kind: anchor.kind ?? "decision",
      text: anchor.text.trim().slice(0, MAX_ANCHOR_CHARS),
      ...(typeof anchor.source === "string"
        ? { source: anchor.source.slice(0, MAX_SOURCE_THREAD_ID_LENGTH) }
        : {}),
      createdAt:
        typeof anchor.createdAt === "string"
          ? anchor.createdAt
          : new Date().toISOString(),
    }));

  if (incoming.length === 0) {
    return json({ ok: true, stored: 0 });
  }

  const existing = session.isOwner ? await readFileProfile() : null;
  const merged = mergeProfile(existing, {
    version: MEMORY_VERSION,
    updatedAt: new Date().toISOString(),
    anchors: incoming,
  });

  const fileWritten = session.isOwner ? await writeFileProfile(merged) : false;

  const { error: dbError } = await session.client.from("brand_memory").insert(
    incoming.map((anchor) => ({
      owner_id: session.userId,
      namespace: "account_memory",
      source_thread_id: anchor.source ?? null,
      version: MEMORY_VERSION,
      content: JSON.stringify({
        [ENVELOPE]: "anchor",
        ...anchor,
        namespace: "account_memory",
        sourceThreadId: anchor.source ?? null,
        version: MEMORY_VERSION,
      }),
    }))
  );

  if (dbError) {
    return json(
      {
        ok: false,
        stored: 0,
        fileWritten,
        database: false,
        error: "Memory could not be saved.",
      },
      500
    );
  }

  return json({
    ok: true,
    stored: incoming.length,
    fileWritten,
    database: true,
    profile: merged,
  });
}
