import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { getLocalDraftIssue } from "@/lib/local-draft-review";
import { getOwnerAuthorizationDecision } from "@/lib/ownerAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSPECTABLE_FILES = [
  "app/page.tsx",
  "app/api/local-ai/route.ts",
  "app/api/local-diagnostics/route.ts",
  "app/local-diagnostics/page.tsx",
  "package.json",
  "next.config.js",
  "tailwind.config.ts",
];
const EDITABLE_FILES = [
  "app/page.tsx",
  "app/api/local-ai/route.ts",
  "app/api/local-diagnostics/route.ts",
  "app/local-diagnostics/page.tsx",
  "app/globals.css",
  "next.config.js",
  "tailwind.config.ts",
];
const MAX_LOCAL_FILE_BYTES = 60000;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function resolveProjectFile(root: string, requestedPath: string) {
  const candidate = path.resolve(root, requestedPath);
  const realRoot = realpathSync(root);
  const realFile = realpathSync(candidate);
  const relativePath = path.relative(realRoot, realFile);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("The selected file must stay inside the OmniAI project folder.");
  }
  return realFile;
}

async function isAuthorizedLocal(request: Request) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") return false;

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return false;

  const ownerDecision = getOwnerAuthorizationDecision(
    data.user.id,
    process.env.OMNIAI_OWNER_ID,
  );

  if (ownerDecision !== "owner") return false;

  return true;
}

export async function GET(request: Request) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      { error: "Local diagnostics are unavailable in hosted deployments." },
      { status: 404 },
    );
  }

  if (!(await isAuthorizedLocal(request))) {
    return NextResponse.json({ error: "Local diagnostics require a signed-in OmniAI session on this laptop." }, { status: 401 });
  }

  // This first version reports a small, fixed set of local project facts. It
  // does not accept paths, read source files, or run shell commands.
  const root = process.cwd();
  let scripts: Record<string, string> = {};
  try {
    const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    scripts = packageJson.scripts ?? {};
  } catch {
    // Keep the diagnostic useful even if package.json is missing or invalid.
  }

  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
    .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "folder" : "file" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const memory = process.memoryUsage();

  return NextResponse.json({
    workspace: path.basename(root),
    runtime: process.version,
    dependenciesInstalled: existsSync(path.join(root, "node_modules")),
    entries,
    scripts,
    inspectableFiles: INSPECTABLE_FILES,
    editableFiles: EDITABLE_FILES,
    access: "read-only inspection; file edits require explicit approval",
    host: {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      rss: memory.rss,
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
}

let buildRunning = false;

function restoreGeneratedTypeScriptConfig(originalText: string) {
  if (!originalText) return;
  try {
    const original = JSON.parse(originalText);
    const current = JSON.parse(readFileSync(path.join(process.cwd(), "tsconfig.json"), "utf8"));
    if (Array.isArray(current.include)) {
      current.include = current.include.filter((entry: unknown) => entry !== ".next-diagnostic/types/**/*.ts");
    }
    if (JSON.stringify(current) === JSON.stringify(original)) {
      writeFileSync(path.join(process.cwd(), "tsconfig.json"), originalText, "utf8");
    }
  } catch {
    // Preserve any config that changed beyond Next.js adding its diagnostic types.
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      { error: "Local diagnostics are unavailable in hosted deployments." },
      { status: 404 },
    );
  }

  if (!(await isAuthorizedLocal(request))) {
    return NextResponse.json({ error: "Local diagnostics require a signed-in OmniAI session on this laptop." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.action === "read-file") {
    if (typeof body.path !== "string" || !INSPECTABLE_FILES.includes(body.path)) {
      return NextResponse.json({ error: "That file is not on the local inspection allowlist." }, { status: 400 });
    }

    try {
      const root = process.cwd();
      const realFile = resolveProjectFile(root, body.path);
      if (statSync(realFile).size > MAX_LOCAL_FILE_BYTES) {
        return NextResponse.json({ error: "That file is too large for this first inspection step." }, { status: 413 });
      }
      const content = readFileSync(realFile, "utf8");
      return NextResponse.json({ path: body.path, content, hash: sha256(content), access: "read-only" });
    } catch {
      return NextResponse.json({ error: "Could not read the selected project file." }, { status: 404 });
    }
  }

  if (body?.action === "approve-edit") {
    if (typeof body.path !== "string" || !EDITABLE_FILES.includes(body.path) || typeof body.oldHash !== "string" || typeof body.content !== "string") {
      return NextResponse.json({ error: "The approved edit is missing valid file details." }, { status: 400 });
    }
    if (!body.content.trim() || Buffer.byteLength(body.content, "utf8") > MAX_LOCAL_FILE_BYTES) {
      return NextResponse.json({ error: "The proposed file is empty or too large to save." }, { status: 413 });
    }

    try {
      const root = process.cwd();
      const filePath = resolveProjectFile(root, body.path);
      const currentContent = readFileSync(filePath, "utf8");
      if (sha256(currentContent) !== body.oldHash) {
        return NextResponse.json({ error: "This file changed after the draft was made. Read it again and create a fresh draft before saving." }, { status: 409 });
      }
      if (currentContent === body.content) {
        return NextResponse.json({ error: "The proposed version is identical to the current file." }, { status: 400 });
      }
      const draftIssue = getLocalDraftIssue(body.path, body.content, currentContent);
      if (draftIssue) {
        return NextResponse.json({ error: draftIssue }, { status: 422 });
      }

      const backupDirectory = path.join(root, ".pilot-local-backups");
      if (path.dirname(backupDirectory) !== root) throw new Error("Invalid backup location.");
      mkdirSync(backupDirectory, { recursive: true });
      const backupName = `${body.path.replace(/[\\/]/g, "_")}.${Date.now()}.bak`;
      const backupPath = path.join(backupDirectory, backupName);
      writeFileSync(backupPath, currentContent, { flag: "wx" });

      const temporaryPath = `${filePath}.pilot-${randomUUID()}.tmp`;
      try {
        writeFileSync(temporaryPath, body.content, { flag: "wx" });
        renameSync(temporaryPath, filePath);
      } catch (error) {
        try { rmSync(temporaryPath, { force: true }); } catch { /* leave the original intact */ }
        throw error;
      }

      return NextResponse.json({ saved: true, path: body.path, backup: path.relative(root, backupPath) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the approved file." }, { status: 500 });
    }
  }

  if (body?.action === "ollama") {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return NextResponse.json({ reachable: false, models: [], llama32Installed: false, reason: `Ollama replied with status ${response.status}.` });
      }
      const data = await response.json();
      const models = Array.isArray(data.models)
        ? data.models.map((model: { name?: unknown; model?: unknown }) =>
            typeof model.name === "string" ? model.name : typeof model.model === "string" ? model.model : ""
          ).filter(Boolean)
        : [];
      return NextResponse.json({
        reachable: true,
        models,
        llama32Installed: models.some((name: string) => name === "llama3.2" || name.startsWith("llama3.2:")),
      });
    } catch {
      return NextResponse.json({
        reachable: false,
        models: [],
        llama32Installed: false,
        reason: "Could not reach Ollama at 127.0.0.1:11434. Check that Ollama is running on this laptop.",
      });
    }
  }

  if (body?.action !== "build") {
    return NextResponse.json({ error: "Choose a supported diagnostic action." }, { status: 400 });
  }
  if (buildRunning) {
    return NextResponse.json({ error: "A build check is already running." }, { status: 409 });
  }

  buildRunning = true;
  const root = process.cwd();
  let originalTsconfig = "";
  try {
    originalTsconfig = readFileSync(path.join(root, "tsconfig.json"), "utf8");
  } catch {
    // The build itself will provide the relevant missing-config error.
  }
  const startedAt = Date.now();
  const cli = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const buildDirectory = path.join(root, ".next-diagnostic");

  try {
    if (path.dirname(buildDirectory) === root) {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
    const result = await new Promise<{ code: number | null; output: string; timedOut: boolean }>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, "build"], {
        cwd: root,
        env: { ...process.env, NODE_ENV: "production", PILOT_BUILD_CHECK: "1" },
        windowsHide: true,
      });
      let output = "";
      let timedOut = false;
      const keepTail = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-18000);
      };
      child.stdout.on("data", keepTail);
      child.stderr.on("data", keepTail);
      child.once("error", reject);
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 180000);
      child.once("close", (code) => {
        clearTimeout(timeout);
        resolve({ code, output, timedOut });
      });
    });

    return NextResponse.json({
      passed: result.code === 0 && !result.timedOut,
      timedOut: result.timedOut,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      output: result.output,
    });
  } catch (error) {
    return NextResponse.json({ error: `Could not start the build check: ${String(error)}` }, { status: 500 });
  } finally {
    restoreGeneratedTypeScriptConfig(originalTsconfig);
    buildRunning = false;
  }
}
