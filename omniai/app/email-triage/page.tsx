"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EmailAlert = {
  subject: string;
  sender: string;
  priority: string;
  reason: string;
  snippet: string;
};

type ScanResult = {
  total: number;
  alerts: EmailAlert[];
};

export default function EmailTriagePage() {
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  async function handleScan() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const bearer = sessionData.session?.access_token;
      if (!bearer) throw new Error("Sign in to OmniAI first.");

      const response = await fetch("/api/email-triage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "gmail-scan",
          accessToken,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Gmail triage failed.");
      }

      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not scan Gmail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Email triage</h1>
        <p className="mt-2 text-sm text-slate-300">
          Connect a valid Gmail OAuth access token to scan unread mail for recruiter, job, and urgent follow-up signals.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <label className="mb-2 block text-sm font-medium text-slate-200">Gmail OAuth access token</label>
        <textarea
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          rows={6}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-violet-500"
          placeholder="Paste a valid OAuth access token here for Gmail API access"
        />

        <button
          type="button"
          onClick={() => void handleScan()}
          disabled={loading || !accessToken.trim()}
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Scanning Gmail..." : "Scan for important emails"}
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Priority emails ({result.total})</h2>
          {result.alerts.length === 0 ? (
            <p className="text-sm text-slate-300">No urgent or opportunity-related messages were found in the current Gmail scan.</p>
          ) : (
            <div className="space-y-3">
              {result.alerts.map((alert) => (
                <article key={alert.subject + alert.sender} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <h3 className="font-medium text-slate-100">{alert.subject || "No subject"}</h3>
                    <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-violet-200">
                      {alert.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{alert.sender}</p>
                  <p className="mt-2 text-sm text-slate-300">{alert.reason}</p>
                  <p className="mt-2 text-sm text-slate-400">{alert.snippet || "No snippet available."}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
