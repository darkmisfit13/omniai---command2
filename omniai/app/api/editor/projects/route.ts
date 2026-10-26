import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";
import {
  MAX_PROJECT_JSON_BYTES,
  cleanProjectName,
  parseProject,
  projectJsonBytes,
} from "@/lib/editor/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const { data, error } = await session.client
    .from("editor_projects")
    .select("id,title,project_version,created_at,updated_at")
    .eq("owner_id", session.userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return json({ error: "Could not load editor projects." }, 500);
  return json({ projects: data ?? [] });
}

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Send a JSON object containing title and project_data." }, 400);
  }

  const raw = body as Record<string, unknown>;
  if (projectJsonBytes(raw.project_data) > MAX_PROJECT_JSON_BYTES) {
    return json({ error: "Project is too large to save (1 MB maximum)." }, 413);
  }
  const project = parseProject(raw.project_data);
  if (!project) return json({ error: "Project data is invalid or unsupported." }, 400);

  const title = cleanProjectName(typeof raw.title === "string" ? raw.title : project.name);
  const { data, error } = await session.client
    .from("editor_projects")
    .insert({
      owner_id: session.userId,
      title,
      project_version: project.version,
      project_data: project,
    })
    .select("id,title,project_version,created_at,updated_at")
    .single();

  if (error) return json({ error: "Could not save the editor project. Confirm the editor database migration has been applied." }, 500);
  return json({ project: data }, 201);
}
