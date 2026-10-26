import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOwnerAuthorizationDecision } from "@/lib/ownerAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalAction = "route" | "inspect" | "suggest" | "edit" | "chat";
const MAX_PROMPT_LENGTH = 80000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorizeUser(request: Request): Promise<Response | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in is required to use the local model." }, 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Local model authentication is not configured." }, 503);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return json({ error: "Your sign-in expired. Sign in again to use the local model." }, 401);
  }


  const ownerDecision = getOwnerAuthorizationDecision(
    data.user.id,
    process.env.OMNIAI_OWNER_ID,
  );

  if (ownerDecision === "not-configured") {
    return json(
      { error: "Local model owner access is not configured." },
      503,
    );
  }

  if (ownerDecision === "not-owner") {
    return json(
      { error: "You are not authorized to use the local model." },
      403,
    );
  }

  return null;
}

function getOllamaEndpoint() {
  if (process.env.VERCEL === "1") {
    throw new Error("Local Ollama is available only from the laptop app.");
  }

  const baseUrl = new URL(process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434");
  if (baseUrl.protocol !== "http:" || !LOOPBACK_HOSTS.has(baseUrl.hostname)) {
    throw new Error("Ollama must be running on this laptop at a loopback address.");
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error("OLLAMA_BASE_URL must not contain credentials.");
  }
  return new URL("/api/generate", baseUrl);
}

export async function POST(request: Request) {
  if (process.env.VERCEL === "1") {
    return json(
      { error: "Local Ollama is available only from the laptop app." },
      404,
    );
  }

  const denied = await authorizeUser(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Request body must be a JSON object." }, 400);
  }

  const requestBody = body as Record<string, unknown>;
  const prompt = requestBody.prompt;
  const rawAction = requestBody.action;
  const validActions = ["route", "inspect", "suggest", "edit", "chat"];
  if (rawAction !== undefined && !validActions.includes(String(rawAction))) {
    return json({ error: "The action must be route, inspect, suggest, edit, or chat." }, 400);
  }
  const action: LocalAction = rawAction === undefined ? "chat" : rawAction as LocalAction;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return json({ error: "A prompt is required." }, 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: "That request is too large for the local model. Try a smaller request." }, 413);
  }

  try {
    const model = process.env.OLLAMA_MODEL?.trim() || "llama3.2";
    const ollamaBody: Record<string, unknown> = { model, prompt, stream: false };
    if (action === "route") {
      ollamaBody.format = "json";
      ollamaBody.options = { temperature: 0, num_predict: 120 };
    } else if (action === "inspect") {
      ollamaBody.options = { temperature: 0.2, num_predict: 180 };
    } else if (action === "suggest") {
      ollamaBody.format = "json";
      ollamaBody.options = { temperature: 0.25, num_predict: 350 };
    } else if (action === "edit") {
      ollamaBody.format = "json";
      ollamaBody.options = { temperature: 0.1, num_predict: 900 };
    }

    const timeoutMs = action === "edit" ? 180000 : 120000;
    const response = await fetch(getOllamaEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaBody),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.error("Ollama request failed with status", response.status);
      return json({ error: "Ollama did not accept the request. Check that it is running on this laptop." }, 502);
    }

    const data = await response.json();
    const answer = typeof data?.response === "string" ? data.response : "";
    if (action === "route") {
      try {
        const decision = JSON.parse(answer);
        return json({
          route: decision?.route === "local" ? "local" : "escalate",
          reason: typeof decision?.reason === "string" ? decision.reason : "",
        });
      } catch {
        return json({ route: "escalate", reason: "The local router returned an invalid decision." });
      }
    }
    return json({ response: answer, model: typeof data?.model === "string" ? data.model : model });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("Local Ollama request failed", error);
    return json(
      {
        error: timedOut
          ? "The local model timed out. Try a smaller request or check that Ollama is running."
          : "The local model is unavailable. Check that Ollama is running on this laptop.",
      },
      timedOut ? 504 : 502
    );
  }
}
