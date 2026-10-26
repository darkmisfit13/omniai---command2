import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface WatchEntry {
  path: string;
  mtimeMs: number;
  size: number;
  hash: string;
  changedAt: number;
}

interface CacheState {
  root: string;
  entries: Map<string, WatchEntry>;
  lastToken: number;
}

const states = new Map<string, CacheState>();

function norm(root: string): string {
  return path.resolve(root).toLowerCase();
}

export function initWatcher(rootDir: string): string {
  const root = norm(rootDir);
  if (states.has(root)) return root;
  states.set(root, { root: rootDir, entries: new Map(), lastToken: 0 });
  return root;
}

export function statFile(absPath: string): WatchEntry | null {
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile()) return null;
    const content = fs.readFileSync(absPath);
    const hash = crypto.createHash("sha1").update(content).digest("hex");
    return { path: absPath, mtimeMs: st.mtimeMs, size: st.size, hash, changedAt: Date.now() };
  } catch {
    return null;
  }
}

export function recordFile(rootDir: string, relPath: string): WatchEntry | null {
  const root = initWatcher(rootDir);
  const abs = path.join(rootDir, relPath);
  const entry = statFile(abs);
  const state = states.get(root)!;
  if (entry) state.entries.set(relPath.replace(/\\/g, "/"), entry);
  return entry;
}

export function diffSince(rootDir: string, sinceToken: number): { token: number; changed: WatchEntry[]; removed: string[] } {
  const root = initWatcher(rootDir);
  const state = states.get(root)!;
  const token = Date.now();
  const changed: WatchEntry[] = [];
  const seen = new Set<string>();

  const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".sql", ".prisma"]);
  const allowedDir = (d: string) => !/(node_modules|\.next|\.git)/.test(d);

  function walk(dir: string, depth: number) {
    if (depth > 5) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      if (e.isDirectory()) {
        if (allowedDir(rel)) walk(full, depth + 1);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!exts.has(ext)) continue;
        seen.add(rel);
        const prev = state.entries.get(rel);
        const st = statFile(full);
        if (!st) continue;
        if (!prev || prev.mtimeMs !== st.mtimeMs || prev.size !== st.size || prev.hash !== st.hash) {
          state.entries.set(rel, st);
          if (st.changedAt > sinceToken) changed.push(st);
        }
      }
    }
  }
  walk(rootDir, 0);

  const removed: string[] = [];
  for (const rel of state.entries.keys()) {
    if (!seen.has(rel)) {
      removed.push(rel);
      state.entries.delete(rel);
    }
  }

  state.lastToken = token;
  return { token, changed, removed };
}

export function cachedEntries(rootDir: string): number {
  return states.get(norm(rootDir))?.entries.size ?? 0;
}