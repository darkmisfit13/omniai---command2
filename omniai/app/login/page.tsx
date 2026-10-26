"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NeuralGrid from "./NeuralGrid";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Land on the dashboard — the hub, not the chat. Full reload so the
    // session is freshly read on the page that needs it.
    window.location.href = "/dashboard";
  }

  return (
    <div className="relative flex min-h-[86vh] flex-col justify-center px-4 py-16">
      <NeuralGrid />

      <div className="relative mx-auto w-full max-w-md">
      <div className="mb-8 flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff]">
          <span
            aria-hidden="true"
            className="dms-heartbeat absolute inset-0 bg-[radial-gradient(circle_at_32%_25%,rgba(108,99,255,0.5),transparent_70%)]"
          />
          <svg
            viewBox="0 0 24 24"
            width="34"
            height="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="relative"
          >
            <path d="M12 20.7S3.6 15 3.6 9.4A4.65 4.65 0 0 1 12 6.95a4.65 4.65 0 0 1 8.4 2.45c0 5.6-8.4 11.3-8.4 11.3Z" />
            <path d="M5.1 12.1h2.9l1.3-2.5 2 4.9 1.5-3.1 1.1 1.8h3" />
          </svg>
        </div>

        <div className="min-w-0">
          <h1 className="dms-display text-4xl font-extrabold leading-none tracking-[-0.03em] text-[#e8e6f2]">
            OmniAI
          </h1>
          <p className="dms-mono mt-2 text-[10px] tracking-[0.34em] text-[#a69eff]">
            DARKMISFITSTUDIOS
          </p>
        </div>
      </div>

      <p className="dms-mono mb-8 max-w-sm text-[10px] leading-5 tracking-[0.2em] text-[#9490ac]">
        AI RESEARCH &amp; CONTENT CREATION
        <br />
        <span className="text-[#716c8b]">
          Heartbreak, loss and betrayal — rendered as art.
        </span>
      </p>

      <div className="dms-rim-light dms-grain space-y-3 rounded-2xl border border-[#211d34] bg-[#14121f]/92 p-5 shadow-[0_24px_70px_-30px_rgba(108,99,255,0.4)] backdrop-blur-xl">
        <label className="dms-mono block text-[10px] tracking-[0.2em] text-[#9490ac]" htmlFor="dms-email">
          EMAIL
        </label>
        <input
          id="dms-email"
          className="w-full rounded-lg border border-[#211d34] bg-[#0b0a14] px-3 py-2.5 text-sm text-[#e8e6f2] outline-none transition placeholder:text-[#4a4160] focus:border-[#8b7fff]/70 focus:shadow-[0_0_0_3px_rgba(139,127,255,0.14)]"
          placeholder="you@studio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="dms-mono block text-[10px] tracking-[0.2em] text-[#9490ac]" htmlFor="dms-password">
          PASSWORD
        </label>
        <input
          id="dms-password"
          type="password"
          className="w-full rounded-lg border border-[#211d34] bg-[#0b0a14] px-3 py-2.5 text-sm text-[#e8e6f2] outline-none transition placeholder:text-[#4a4160] focus:border-[#8b7fff]/70 focus:shadow-[0_0_0_3px_rgba(139,127,255,0.14)]"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        {error && (
          <p className="rounded-lg border border-[#8b7fff]/40 bg-[#8b7fff]/10 px-3 py-2 text-sm text-[#c5bfff]">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-r from-[#5b39b4] to-[#6c63ff] px-4 py-2.5 text-sm font-semibold tracking-wide text-white transition hover:from-[#6c63ff] hover:to-[#8b7fff] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Opening…" : "Enter the workspace"}
        </button>
      </div>

      <p className="mt-6 max-w-sm text-xs leading-5 text-[#716c8b]">
        There&apos;s no sign-up here on purpose — this account is created directly in
        Supabase&apos;s dashboard (Authentication → Users → Add user).
      </p>
      </div>
    </div>
  );
}
