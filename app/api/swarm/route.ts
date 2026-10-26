import { NextResponse } from "next/server";
import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";
import { runSwarm, decomposeInstruction } from "@/lib/swarm/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function getOllamaEndpoint(model?: string) {
  const baseUrl = new URL(process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434");
  if (baseUrl.protocol !== "http:" || !LOOPBACK_HOSTS.has(baseUrl.hostname)) {
    throw new Error("Ollama must be running on a loopback address.");
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error("Ollama URL credentials are not allowed.");
  }
  return new URL("/api/chat", baseUrl);
}

async function ollamaChat(prompt: string, systemPrompt: string | undefined, timeoutMs: number, modelOverride?: string): Promise<{ model: string; text: string }> {
  const model = modelOverride ?? process.env.OLLAMA_MODEL?.trim() ?? "llama3.2";
  const endpoint = getOllamaEndpoint(model);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      stream: false,
      options: { temperature: 0.4, num_predict: 900 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
  const data = (await resp.json()) as { message?: { content?: string }; model?: string };
  return { model: data.model ?? model, text: data.message?.content ?? "" };
}

async function heavyGenerate(prompt: string, systemPrompt?: string): Promise<{ model: string; text: string }> {
  const hfToken = process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN;
  const hfModel = process.env.HUGGINGFACE_TEXT_MODEL;
  if (hfToken && hfModel) {
    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: `${systemPrompt ?? ""}\n\n${prompt}`,
          parameters: { max_new_tokens: 900, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(120000),
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json() as unknown;
        const text = Array.isArray(j) ? (j[0] as { generated_text?: string })?.generated_text ?? "" : String(j ?? "");
        if (text) return { model: hfModel, text };
      }
    } catch {
      // fall through to local
    }
  }
  return ollamaChat(prompt, systemPrompt, 180000, process.env.OLLAMA_HEAVY_MODEL);
}

export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const instr = (body as { instruction?: unknown })?.instruction;
  const action = (body as { action?: unknown })?.action;
  if (typeof instr !== "string" || !instr.trim()) return json({ error: "instruction is required." }, 400);

  const subtasks = decomposeInstruction(instr.trim());
  const plan = { instruction: instr.trim(), subtasks };

  if (action === "decompose") {
    return json({ plan });
  }

  const textGenerate = async (tier: "heavy" | "fast", prompt: string, systemPrompt?: string) => {
    if (tier === "heavy") return heavyGenerate(prompt, systemPrompt);
    return ollamaChat(prompt, systemPrompt, 120000);
  };

  try {
    const result = await runSwarm(instr.trim(), textGenerate, {
      onProgress: () => {},
      plan,
    });
    return json({
      instruction: result.instruction,
      subtasks: result.plan.subtasks,
      results: result.results,
      synthesis: result.synthesis,
      totalMs: result.totalMs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Swarm run failed.";
    return json({ error: msg }, 502);
  }
}
