import {
  authorizeUser,
  isUserSession,
  json,
} from "@/lib/generation/serverAuth";
import {
  formatPreflight,
  preflightFiles,
  type PreflightFile,
} from "@/lib/sandbox/preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sandbox preflight — authenticated, deterministic artifact verification.
 *
 * POST { files: [{ path, content }] } → { pass, counts, findings, text }
 *
 * This is the server half of the self-healing sandbox: the client (or the
 * Director orchestration chain) sends the generated artifact set, and gets
 * back structured findings plus a formatted trace to feed straight back into
 * the model. No browser is launched — see lib/sandbox/preflight.ts for why.
 */

const MAX_FILES = 80;
const MAX_FILE_CHARS = 200_000;

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const rawFiles = (body as { files?: unknown })?.files;
  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    return json({ error: "Provide a non-empty `files` array of { path, content }." }, 400);
  }
  if (rawFiles.length > MAX_FILES) {
    return json({ error: `Too many files (max ${MAX_FILES}).` }, 413);
  }

  const files: PreflightFile[] = [];
  for (const entry of rawFiles) {
    const path = (entry as { path?: unknown })?.path;
    const content = (entry as { content?: unknown })?.content;
    if (typeof path !== "string" || !path.trim()) {
      return json({ error: "Every file needs a string `path`." }, 400);
    }
    if (typeof content !== "string") {
      return json({ error: `File "${path}" needs string \`content\`.` }, 400);
    }
    if (content.length > MAX_FILE_CHARS) {
      return json({ error: `File "${path}" exceeds ${MAX_FILE_CHARS} characters.` }, 413);
    }
    files.push({ path: path.replace(/\\/g, "/"), content });
  }

  const report = preflightFiles(files);
  return json({
    pass: report.pass,
    files: report.files,
    counts: report.counts,
    findings: report.findings,
    text: formatPreflight(report),
  });
}
