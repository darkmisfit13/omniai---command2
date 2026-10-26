"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function WebsitePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setResult(null);
    if (!url.trim()) {
      setError("Enter a website URL first.");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const authHeader = token ? "Bearer " + token : "";
      const res = await fetch("/api/website-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Analysis failed.");
      setResult(typeof json === "string" ? json : JSON.stringify(json, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="pilot-voice text-2xl">Website Analyzer</h2>
        <p className="text-sm text-ash mt-1">
          Audit any website - performance, SEO, content, and structure - and get an
          actionable OmniAI strategy for updating it.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-[#5b39b4] to-[#6c63ff] px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze site"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-[#211d34] bg-[#14121f] p-4">
          <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-[#b7b0c9]">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
