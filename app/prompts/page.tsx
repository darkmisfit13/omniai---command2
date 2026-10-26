"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const SAMPLE_PROMPTS = [
  "Write a blog post about AI art",
  "Generate a product landing page hero",
  "Compose a cinematic music track",
  "Summarize this article in 5 bullets",
];

export default function PromptsPage() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"enhance" | "fix" | "expand" | "shorten">("enhance");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function enhance() {
    if (!input.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in required.");
      const verbs: Record<string, string> = {
        enhance: "Enhance the following prompt with clear goals, constraints, examples, and evaluation criteria. Return ONLY the improved prompt.",
        fix: "Fix and clarify this prompt so it is unambiguous and actionable. Return ONLY the improved prompt.",
        expand: "Expand this prompt with more detail, context, and specifics while keeping the core intent. Return ONLY the improved prompt.",
        shorten: "Shorten this prompt to its essential instruction without losing meaning. Return ONLY the improved prompt.",
      };
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: `${verbs[mode]}\n\n${input.trim()}`, system: "You are a professional prompt engineer. Return only the rewritten prompt, no preamble." }),
      });
      const data2 = await res.json().catch(() => ({}));
      if (!res.ok || !data2.text) throw new Error(data2.guidance ? `${data2.error} ${data2.guidance}` : (data2.error ?? `Failed (HTTP ${res.status})`));
      setResult(data2.text);
    } catch (e) {
      setResult(`(offline boilerplate) ${input.trim()}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#302747] bg-gradient-to-br from-[#21183b] via-[#14121f] to-[#10101a] p-5 sm:p-6">
        <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#6c63ff]/15 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a69eff]">Prompt Craft · Refine</p>
          <h1 className="pilot-voice text-2xl">Prompt Studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ash">
            Shape a clear instruction before it reaches a model. Choose a mode, add your draft, and review the result.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#c5bfff]">
            <span className="rounded-full border border-[#8b7fff]/30 bg-[#6c63ff]/10 px-2.5 py-1">Enhance</span>
            <span className="rounded-full border border-[#8b7fff]/30 bg-[#6c63ff]/10 px-2.5 py-1">Fix</span>
            <span className="rounded-full border border-[#8b7fff]/30 bg-[#6c63ff]/10 px-2.5 py-1">Expand</span>
            <span className="rounded-full border border-[#8b7fff]/30 bg-[#6c63ff]/10 px-2.5 py-1">Shorten</span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["enhance", "fix", "expand", "shorten"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
              mode === m
                ? "bg-[#6c63ff]/20 text-[#c5bfff] border border-[#6c63ff]/40"
                : "border border-[#211d34] text-ash hover:text-[#e8e6f2]"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        placeholder="Paste or write a prompt to improve..."
        className="w-full"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void enhance()}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-gradient-to-r from-[#5b39b4] to-[#6c63ff] px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {loading ? "Working..." : "Enhance prompt"}
        </button>
        {input.trim() === "" && (
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="text-xs text-[#a69eff] hover:text-[#e8e6f2]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-[#211d34] bg-[#14121f] p-4">
          <p className="text-xs uppercase tracking-wider text-ash mb-2">Enhanced prompt</p>
          <pre className="whitespace-pre-wrap text-sm text-[#e8e6f2] leading-6">{result}</pre>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(result)}
            className="mt-3 text-xs text-[#a69eff] hover:text-[#e8e6f2]"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
