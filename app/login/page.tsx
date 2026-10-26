"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { safeNextPath } from "@/lib/billing/purchaseIntent";
import NeuralGrid from "./NeuralGrid";
import MfaChallenge from "./MfaChallenge";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const wantSignup = searchParams?.get("signup") === "1";
  // Where to send the user once authenticated. Only a same-origin path is
  // accepted, so `?next=` can preserve a purchase intent without becoming an
  // open redirect. Defaults to the dashboard.
  const nextPath = safeNextPath(searchParams?.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">(wantSignup ? "signup" : "signin");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // Set once the password was accepted but the account has a verified
  // authenticator app that must still be challenged (AAL1 -> AAL2). While set,
  // `MfaChallenge` renders a mandatory fullscreen overlay and the workspace
  // stays gated behind AAL2 in AuthGate.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  useEffect(() => { if (wantSignup) setMode("signup"); }, [wantSignup]);

  // Already half-signed-in (AAL1) from a previous visit? Skip the password
  // form and go straight to the code overlay. Fully signed-in? Leave for the app.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (aal?.currentLevel === "aal2") {
        router.push(nextPath);
        return;
      }
      const verified = factors?.totp[0] ?? null;
      if (verified) {
        setMode("signin");
        setMfaFactorId(verified.id);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchAccount() {
    await supabase.auth.signOut();
    setMfaFactorId(null);
    setError("");
    setInfo("");
    setPassword("");
  }

  async function handleAuth() {
    setError("");
    setInfo("");
    setBusy(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + nextPath, data: username ? { display_name: username, full_name: username } : {} },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.user && !data.session) {
        setInfo("Check your email — we sent a verification link to confirm your account, then sign in to continue.");
        return;
      }
      router.push(nextPath);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);

    // Intercept the transition: if the account has a verified second factor the
    // session is only half-signed-in (AAL1). Hand off to the verification
    // overlay instead of leaving the page.
    const verifiedFactor = (data.user?.factors ?? []).find(
      (f) => f.status === "verified" && f.factor_type === "totp"
    ) ?? (data.user?.factors ?? []).find((f) => f.status === "verified");
    if (verifiedFactor) {
      setMfaFactorId(verifiedFactor.id);
      return;
    }

    // Land on the dashboard (the hub, not the chat).
    router.push(nextPath);
  }

  return (
    <div className="relative flex min-h-[86vh] flex-col justify-center px-4 py-16">
      <NeuralGrid />

      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff]">
            <span aria-hidden="true" className="dms-heartbeat absolute inset-0 bg-[radial-gradient(circle_at_32%_25%,rgba(108,99,255,0.5),transparent_70%)]" />
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="relative">
              <path d="M12 20.7S3.6 15 3.6 9.4A4.65 4.65 0 0 1 12 6.95a4.65 4.65 0 0 1 8.4 2.45c0 5.6-8.4 11.3-8.4 11.3Z" />
              <path d="M5.1 12.1h2.9l1.3-2.5 2 4.9 1.5-3.1 1.1 1.8h3" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="dms-display text-4xl font-extrabold leading-none tracking-[-0.03em] text-[#e8e6f2]">OmniAI</h1>
            <p className="dms-mono mt-2 text-[10px] tracking-[0.34em] text-[#a69eff]">DARKMISFITSTUDIOS</p>
          </div>
        </div>

        <p className="dms-mono mb-8 max-w-sm text-[10px] leading-5 tracking-[0.2em] text-[#9490ac]">
          AI RESEARCH &amp; CONTENT CREATION
          <br />
          <span className="text-[#716c8b]">Heartbreak, loss and betrayal — rendered as art.</span>
        </p>

        <div className="dms-rim-light dms-grain space-y-3 rounded-2xl border border-[#211d34] bg-[#14121f]/92 p-5 shadow-[0_24px_70px_-30px_rgba(108,99,255,0.4)] backdrop-blur-xl">
          {mode === "signup" && (
            <>
              <label className="dms-mono block text-[10px] tracking-[0.2em] text-[#9490ac]" htmlFor="username">USERNAME</label>
              <input id="username" className="w-full rounded-lg border border-[#211d34] bg-[#0b0a14] px-3 py-2.5 text-sm text-[#e8e6f2] outline-none transition placeholder:text-[#4a4160] focus:border-[#8b7fff]/70 focus:shadow-[0_0_0_3px_rgba(139,127,255,0.14)]" placeholder="your_handle" value={username} onChange={e => setUsername(e.target.value)} />
            </>
          )}
          <label className="dms-mono block text-[10px] tracking-[0.2em] text-[#9490ac]" htmlFor="dms-email">EMAIL</label>
          <input id="dms-email" className="w-full rounded-lg border border-[#211d34] bg-[#0b0a14] px-3 py-2.5 text-sm text-[#e8e6f2] outline-none transition placeholder:text-[#4a4160] focus:border-[#8b7fff]/70 focus:shadow-[0_0_0_3px_rgba(139,127,255,0.14)]" placeholder="you@studio.com" value={email} onChange={e => setEmail(e.target.value)} />

          <label className="dms-mono block text-[10px] tracking-[0.2em] text-[#9490ac]" htmlFor="dms-password">PASSWORD</label>
          <input id="dms-password" type="password" className="w-full rounded-lg border border-[#211d34] bg-[#0b0a14] px-3 py-2.5 text-sm text-[#e8e6f2] outline-none transition placeholder:text-[#4a4160] focus:border-[#8b7fff]/70 focus:shadow-[0_0_0_3px_rgba(139,127,255,0.14)]" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />

          {error && (<p className="rounded-lg border border-[#8b7fff]/40 bg-[#8b7fff]/10 px-3 py-2 text-sm text-[#c5bfff]">{error}</p>)}
          {info && (<p className="rounded-lg border border-[#6ee7b7]/40 bg-[#6ee7b7]/10 px-3 py-2 text-sm text-[#c5bfff]">{info}</p>)}

          <button onClick={handleAuth} disabled={busy} className="w-full rounded-lg bg-gradient-to-r from-[#5b39b4] to-[#6c63ff] px-4 py-2.5 text-sm font-semibold tracking-wide text-white transition hover:from-[#6c63ff] hover:to-[#8b7fff] disabled:cursor-wait disabled:opacity-60">
            {busy ? "Working…" : mode === "signin" ? "Enter the workspace" : "Create account & verify email"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button type="button" className="text-[#a69eff] hover:text-[#e8e6f2]" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}>
            {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-6 max-w-sm text-xs leading-5 text-[#716c8b]">
          Account creation requires email verification. Check your inbox for the confirmation link before signing in. All user codebases, weights, and generations are kept private and are never used to train external models.
        </p>
      </div>

      {mfaFactorId && (
        <MfaChallenge
          factorId={mfaFactorId}
          email={email || undefined}
          onVerified={() => { router.push(nextPath); }}
          onSwitchAccount={() => void switchAccount()}
        />
      )}
    </div>
  );
}
