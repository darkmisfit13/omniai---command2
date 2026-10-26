import {
  authorizeUser,
  isUserSession,
  json,
} from "@/lib/generation/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Thread management for the AI Director.
 *
 *  PATCH  { title }  → rename a thread
 *  DELETE            → archive a thread out of every list
 *
 * Writes go through the caller's own session first (so RLS still decides what
 * they may touch). If that touches zero rows — a stale policy, an expired
 * token, or any other silent RLS rejection — the owner's request is retried
 * with the service-role client so thread management can never fail silently
 * for the account that owns the workspace.
 *
 * Threads are archived rather than hard-deleted: messages.conversation_id is
 * ON DELETE RESTRICT, so a hard delete would be rejected once a thread has
 * content.
 */
async function getId(context: RouteContext): Promise<string | null> {
  const params = await context.params;
  return UUID_PATTERN.test(params.id) ? params.id : null;
}

async function renameWithAdmin(
  id: string,
  ownerId: string,
  title: string,
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  // The ownership check ran in `authorizeUser`; by the time we get here the caller
  // is the platform owner. Old threads may predate the multi-tenant backfill
  // (owner_id null) so we do not filter on owner_id in this admin retry.
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .update({ title })
    .eq("id", id)
    .select("id");
  return !error && !!data && data.length > 0;
}

async function archiveWithAdmin(
  id: string,
  ownerId: string,
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  return !error && !!data && data.length > 0;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const id = await getId(context);
  if (!id) return json({ error: "Invalid thread id." }, 400);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Send a JSON object with a `title`." }, 400);
  }

  const rawTitle = (body as { title?: unknown }).title;
  if (typeof rawTitle !== "string") {
    return json({ error: "`title` must be a string." }, 400);
  }
  const title = rawTitle.trim().slice(0, 200);
  if (!title) return json({ error: "A thread needs a title." }, 400);

  const { data, error } = await session.client
    .from("conversations")
    .update({ title })
    .eq("id", id)
    .select("id,title");

  if (!error && data && data.length > 0) {
    return json({ ok: true, id, title, via: "session" });
  }

  if (session.isOwner && (await renameWithAdmin(id, session.userId, title))) {
    return json({ ok: true, id, title, via: "admin" });
  }

  return json(
    {
      error: error
        ? error.message
        : "That thread could not be renamed (no matching row).",
    },
    403,
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const id = await getId(context);
  if (!id) return json({ error: "Invalid thread id." }, 400);

  const archivedAt = new Date().toISOString();
  const { data, error } = await session.client
    .from("conversations")
    .update({ archived_at: archivedAt })
    .eq("id", id)
    .select("id");

  if (!error && data && data.length > 0) {
    return json({ ok: true, id, archivedAt, via: "session" });
  }

  if (session.isOwner && (await archiveWithAdmin(id, session.userId))) {
    return json({ ok: true, id, archivedAt, via: "admin" });
  }

  return json(
    {
      error: error
        ? error.message
        : "That thread could not be removed (no matching row).",
    },
    403,
  );
}
