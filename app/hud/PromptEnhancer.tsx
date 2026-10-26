"use client";

import { useState } from "react";
import { requestLocalAi } from "@/lib/localAiRelay";

type Props = {
  /** The current draft. Empty drafts are refused rather than sent. */
  value: string;
  /** Replace the field contents with the rewritten prompt. */
  onApply: (next: string) => void;
  /** What this field feeds, e.g. "an image generation model". Drives the rewrite. */
  goal: string;
  /**
   * Extra material the rewrite has to respect — selected style tags, the
   * chosen provider, an aspect ratio. Kept out of `value` but folded into the
   * request so the model doesn't invent constraints the UI already fixed.
   */
  context?: string;
  variant?: "default" | "dark";
  /**
   * "prompt" (default) rewrites a draft *for* a generative model, adding the
   * craft details that move a result. "text" is for fields whose contents are
   * shown to a human — a title, a caption, a persona — and must return the
   * finished wording itself rather than advice about it.
   */
  kind?: "prompt" | "text";
};

/**
 * Strip the scaffolding a chat model tends to wrap an answer in, without
 * touching the prompt itself — a leading "Sure, here's…" or a fenced block
 * would otherwise land in the field.
 */
function sanitize(text: string): string {
  let out = text.trim();
  out = out.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
  out = out.replace(
    /^(?:sure|certainly|of course|absolutely|here(?:'s| is)|below is|the rewritten prompt is)\b[^:\n]*:\s*/i,
    "",
  );

  // Models also announce their answer on its own line — "Rewritten prompt:",
  // "Enhanced version:", "Here you go:". A line that is short, has no full
  // stop, ends in a colon and names this operation is a label, not content.
  const lines = out.split("\n");
  const first = lines[0] ?? "";
  if (
    lines.length > 1 &&
    first.length <= 60 &&
    /:\s*$/.test(first) &&
    !/[.;?!]/.test(first) &&
    /(prompt|rewrit|enhanc|improv|revis|version|draft|output|here|sure|below)/i.test(first)
  ) {
    out = lines.slice(1).join("\n").replace(/^\s+/, "");
  }

  out = out.replace(/^["'`“”]+/, "").replace(/["'`“”]+$/, "");
  return out.trim();
}

export function PromptEnhancer({
  value,
  onApply,
  goal,
  context,
  variant = "default",
  kind = "prompt",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function run() {
    const draft = value.trim();
    if (!draft) {
      setStatus({ kind: "error", text: "Write a rough draft first." });
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      const instruction =
        kind === "text"
          ? [
              "You are a sharp copywriter rewriting text that will be displayed on screen.",
              `Task: ${goal}.`,
              context ? `Context you must respect: ${context}` : "",
              "Return ONLY the finished wording itself, exactly as it should appear.",
              "Do not describe what the text should say, do not give directions or",
              "advice, do not explain your choices. No preamble, no labels, no",
              "quotation marks, no markdown.",
              "",
              "Draft:",
              draft,
            ]
              .filter(Boolean)
              .join("\n")
          : [
              "You are an expert prompt engineer for generative AI tools.",
              `Rewrite the user's draft so it works better for this purpose: ${goal}.`,
              context ? `Constraints you must respect and not override: ${context}` : "",
              "Keep the user's subject, intent and tone. Make it concrete and specific —",
              "add the details that actually move the result (composition, medium, mood,",
              "lighting, era, influences, what to avoid). Do not invent personal facts",
              "about the user. Do not answer the request; only rewrite it.",
              "",
              "Reply with ONLY the rewritten prompt. No preamble, no explanation,",
              "no quotation marks, no markdown, no bullet points.",
              "",
              "Draft:",
              draft,
            ]
              .filter(Boolean)
              .join("\n");

      // The chat page gives the local model 180s; a rewrite is much smaller
      // than a chat turn but Ollama still has to load the model on a cold
      // start, so keep a generous budget rather than failing a slow laptop.
      const result = await requestLocalAi("chat", instruction, 120000);
      if (result.error) throw new Error(result.error);

      const next = sanitize(result.response ?? "");
      if (!next) throw new Error("The model returned nothing usable. Try again.");

      onApply(next);
      setStatus({ kind: "ok", text: kind === "text" ? "Applied." : "Applied to your prompt." });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Enhance failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  const isDark = variant === "dark";

  return (
    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        title="Rewrite this draft with the chat AI"
        className={
          isDark
            ? "inline-flex items-center gap-1.5 rounded-lg border border-[#51467e] bg-[#211b38] px-2.5 py-1 text-[11px] text-[#d9d2ff] transition hover:border-[#8b7fff] disabled:opacity-50"
            : "inline-flex items-center gap-1.5 rounded border border-signal/50 px-2.5 py-1 text-[11px] text-signal transition hover:bg-signal/10 disabled:opacity-50"
        }
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={busy ? "animate-pulse" : undefined}
        >
          <path d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6L4.3 10.2l5.6-2.1L12 2.5z" />
          <path d="M19 15.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z" />
        </svg>
        {busy ? "Enhancing…" : "Enhance prompt"}
      </button>

      {status && (
        <span
          role={status.kind === "error" ? "alert" : "status"}
          className={
            status.kind === "error"
              ? isDark
                ? "text-[11px] text-[#f0a8bd]"
                : "text-[11px] text-rose-300"
              : "text-[11px] text-emerald-300"
          }
        >
          {status.text}
        </span>
      )}
    </span>
  );
}
