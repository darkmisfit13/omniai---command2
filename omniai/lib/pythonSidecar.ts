/**
 * Server-only client for the OmniAI Python sidecar (backend-python/).
 *
 * Call this from Next.js Route Handlers, never from browser components.
 * The shared secret must stay on the laptop process — the same way
 * OLLAMA_BASE_URL is laptop-only and never sent to Vercel.
 *
 * Environment (omniai/.env.local):
 *   PYTHON_SIDECAR_URL=http://127.0.0.1:8765
 *   PYTHON_SIDECAR_SECRET=<same value as backend-python/.env SIDECAR_SHARED_SECRET>
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export type SidecarDiagnosticsResponse = {
  ok: true;
  diagnostics: Record<string, unknown>;
};

export type SidecarPendingApproval = {
  status: "pending_approval";
  approval_id: string;
  action: string;
  details: Record<string, unknown>;
  next_step?: string;
  event?: Record<string, unknown>;
};

export type SidecarTaskKillResponse = {
  ok: true;
  taskkill: {
    attempted: number;
    terminated: number;
    results: Array<{
      pid: number;
      name: string;
      exe: string | null;
      terminated: boolean;
      error: string | null;
    }>;
  };
};

export class SidecarError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "SidecarError";
    this.status = status;
    this.body = body;
  }
}

function sidecarBaseUrl(): URL {
  if (process.env.VERCEL === "1") {
    throw new SidecarError("The Python sidecar is available only on this laptop.", 404, null);
  }

  const raw = process.env.PYTHON_SIDECAR_URL?.trim() || "http://127.0.0.1:8765";
  const url = new URL(raw);

  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new SidecarError("PYTHON_SIDECAR_URL must be a loopback http address.", 503, null);
  }
  if (url.username || url.password) {
    throw new SidecarError("PYTHON_SIDECAR_URL must not contain credentials.", 503, null);
  }

  return url;
}

function sidecarSecret(): string {
  const secret = process.env.PYTHON_SIDECAR_SECRET?.trim();
  if (!secret) {
    throw new SidecarError("PYTHON_SIDECAR_SECRET is not configured.", 503, null);
  }
  return secret;
}

async function sidecarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, sidecarBaseUrl());
  const headers = new Headers(init.headers);
  headers.set("X-OmniAI-Sidecar-Key", sidecarSecret());
  headers.set("Cache-Control", "no-store");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new SidecarError(
      "Could not reach the OmniAI Python sidecar. Start backend-python with `python main.py`.",
      503,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

async function readSidecarJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

function pendingFromBody(body: unknown): SidecarPendingApproval | null {
  if (!body || typeof body !== "object") return null;
  const envelope = body as Record<string, unknown>;
  const error = envelope.error;
  if (!error || typeof error !== "object") return null;
  const detail = error as Record<string, unknown>;
  if (detail.status !== "pending_approval" || typeof detail.approval_id !== "string") {
    return null;
  }
  return detail as SidecarPendingApproval;
}

/**
 * Read-only CPU / memory / disk snapshot from the sidecar.
 * Does not require the human approval loop.
 */
export async function fetchSidecarDiagnostics(): Promise<SidecarDiagnosticsResponse> {
  const response = await sidecarFetch("/api/system/diagnostics", { method: "GET" });
  const body = await readSidecarJson(response);

  if (!response.ok) {
    throw new SidecarError("Sidecar diagnostics failed.", response.status, body);
  }

  return body as SidecarDiagnosticsResponse;
}

export type TaskKillInput = {
  pid?: number;
  name?: string;
  force?: boolean;
  /** Must be true on the second call, after the human confirms. */
  approved?: boolean;
  /** Ticket id returned by the first (HTTP 202) call. */
  approval_id?: string;
};

/**
 * Ask the sidecar to terminate a local process.
 *
 * First call (no approved flag) returns a pending ticket instead of killing.
 * Second call must send the same pid/name plus approved=true and approval_id.
 */
export async function requestSidecarTaskKill(
  input: TaskKillInput,
): Promise<SidecarTaskKillResponse | SidecarPendingApproval> {
  const response = await sidecarFetch("/api/system/taskkill", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = await readSidecarJson(response);
  const pending = pendingFromBody(body);

  if (response.status === 202 && pending) {
    return pending;
  }

  if (!response.ok) {
    throw new SidecarError("Sidecar taskkill failed.", response.status, body);
  }

  return body as SidecarTaskKillResponse;
}

export async function rejectSidecarApproval(approvalId: string): Promise<void> {
  const response = await sidecarFetch(`/api/system/approvals/${encodeURIComponent(approvalId)}/reject`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new SidecarError("Could not reject the sidecar approval.", response.status, await readSidecarJson(response));
  }
}
