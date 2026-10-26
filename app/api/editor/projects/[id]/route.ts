import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";
import {
  MAX_PROJECT_JSON_BYTES,
  cleanProjectName,
  parseProject,
  projectJsonBytes,
} from "@/lib/editor/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getId(context: RouteContext): Promise<string | null> {
  const params = await context.params;
  return UUID_PATTERN.test(params.id) ? params.id : null;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;
  const id = await getId(context);
  if (!id) return json({ error: "Invalid project id." }, 400);

  const { data, error } = await session.client
    .from("editor_projects")
    .select("id,title,project_version,project_data,created_at,updated_at")
    .eq("id", id)
    .eq("owner_id", session.userId)
    .maybeSingle();

  if (error) return json({ error: "Could not load the editor project." }, 500);
  if (!data) return json({ error: "Project not found." }, 404);
  return json({ project: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;
  const id = await getId(context);
  if (!id) return json({ error: "Invalid project id." }, 400);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Send a JSON object containing project_data and optional title." }, 400);
  }

  const raw = body as Record<string, unknown>;
  if (projectJsonBytes(raw.project_data) > MAX_PROJECT_JSON_BYTES) {
    return json({ error: "Project is too large to save (1 MB maximum)." }, 413);
  }
  const project = parseProject(raw.project_data);
  if (!project) return json({ error: "Project data is invalid or unsupported." }, 400);

  const updates: Record<string, unknown> = {
    project_version: project.version,
    project_data: project,
    updated_at: new Date().toISOString(),
  };
  if (raw.title !== undefined) {
    if (typeof raw.title !== "string") return json({ error: "title must be a string." }, 400);
    updates.title = cleanProjectName(raw.title);
  }

  const { data, error } = await session.client
    .from("editor_projects")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", session.userId)
    .select("id,title,project_version,created_at,updated_at")
    .maybeSingle();

  if (error) return json({ error: "Could not update the editor project." }, 500);
  if (!data) return json({ error: "Project not found." }, 404);
  return json({ project: data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;
  const id = await getId(context);
  if (!id) return json({ error: "Invalid project id." }, 400);

  const { data, error } = await session.client
    .from("editor_projects")
    .delete()
    .eq("id", id)
    .eq("owner_id", session.userId)
    .select("id")
    .maybeSingle();

  if (error) return json({ error: "Could not delete the editor project." }, 500);
  if (!data) return json({ error: "Project not found." }, 404);
  return json({ ok: true });
}
