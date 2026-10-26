import { NextResponse } from "next/server";
import { diffSince } from "@/lib/fs/watcherCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  const b = (body ?? {}) as { rootDir?: unknown; sinceToken?: unknown };
  // Security: the server instance only ever watches its own workspace tree.
  const rootDir = process.cwd();
  const sinceToken = typeof b.sinceToken === "number" ? b.sinceToken : 0;
  const result = diffSince(rootDir, sinceToken);
  return NextResponse.json({
    rootDir,
    token: result.token,
    changed: result.changed.map((c) => ({ path: c.path, mtimeMs: c.mtimeMs, size: c.size, hash: c.hash })),
    removed: result.removed,
    cachedEntries: result.changed.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
