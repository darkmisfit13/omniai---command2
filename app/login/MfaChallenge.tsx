"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import NeuralCore from "@/app/hud/NeuralCore";
import GlassNotice, { type NoticeTone } from "@/app/components/GlassNotice";
import OtpInput from "@/app/components/OtpInput";
import { friendlyVerifyError } from "@/app/components/verifyError";

/**
 * The secure login challenge interceptor.
 *
 * Rendered fullscreen the instant a correct password reveals a verified second
 * factor. It hard-blocks the workspace — the rest of the app is gated behind
 * AAL2 in AuthGate — until the caller proves possession of the authenticator
 * with a live `mfa.challenge` + `mfa.verify`. There is no dismiss affordance:
 * the only ways out are a valid code or signing in as someone else.
 */

type Notice = { tone: NoticeTone; text: string } | null;

export default function MfaChallenge({
  factorId,
  email,
  onVerified,
  onSwitchAccount,
}: {
  factorId: string;
  email?: string;
  onVerified: () => void;
  onSwitchAccount: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const startChallenge = useCallback(async () => {
    setNotice({ tone: "working", text: "Preparing a fresh verification challenge…" });
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error || !data) {
      setChallengeId(null);
      setNotice({
        tone: "error",
        text: error?.message ?? "Could not start verification. Try again.",
      });
      return;
    }
    setChallengeId(data.id);
    setNotice({
      tone: "info",
      text: "Enter the current 6-digit code from your authenticator app.",
    });
  }, [factorId]);

  useEffect(() => {
    void startChallenge();
  }, [startChallenge]);

  // The challenge is mandatory: lock page scroll while it is on screen.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function verify(raw = code) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 6 || busy) return;

    setBusy(true);
    setNotice({ tone: "working", text: "Verifying your identity…" });
    try {
      let id = challengeId;
      if (!id) {
        const { data, error } = await supabase.auth.mfa.challenge({ factorId });
        if (error || !data) {
          throw new Error(error?.message ?? "Could not start verification. Try again.");
        }
        id = data.id;
        setChallengeId(id);
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: id,
        code: digits,
      });
      if (verifyError) {
        // Challenges are single-use and expire; mint a fresh one for the retry.
        setChallengeId(null);
        setCode("");
        throw new Error(friendlyVerifyError(verifyError.message));
      }

      setNotice({ tone: "success", text: "Identity confirmed. Entering the studio…" });
      onVerified();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "That code was not accepted. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#05040a]/88 p-4 backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-challenge-title"
    >
      <div className="dms-rim-light dms-grain relative w-[min(460px,94vw)] overflow-hidden rounded-2xl border border-[#2a2444] bg-[#14121f]/95 shadow-[0_40px_130px_-40px_rgba(108,99,255,0.7)] backdrop-blur-2xl">
        {/* WebGL accent banner — the checkpoint is "thinking". */}
        <div className="relative h-32 overflow-hidden border-b border-[#211d34] bg-[radial-gradient(ellipse_at_50%_130%,rgba(0,255,163,0.18),transparent_64%)]">
          <NeuralCore
            className="pointer-events-none absolute inset-0 block h-full w-full opacity-85"
            levels={[0.52, 0.82, 0.64]}
            colors={["#8b7fff", "#00ffa3", "#00f2fe"]}
            active
            pulse={busy}
            label="Security verification visualization"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#14121f] via-[#14121f]/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-3 px-5">
            <p className="dms-mono text-[10px] tracking-[0.32em] text-[#a69eff]">SECURITY CHECKPOINT</p>
            <h2 id="mfa-challenge-title" className="text-lg font-semibold text-[#e8e6f2]">
              Enter Security Verification Code
            </h2>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-[#9490ac]">
            {email ? (
              <>
                A second factor protects{" "}
                <span className="text-[#c5bfff]">{email}</span>. Open your authenticator app and
                enter the current 6-digit code to continue.
              </>
            ) : (
              "Open your authenticator app and enter the current 6-digit code to continue."
            )}
          </p>

          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(digits) => void verify(digits)}
            disabled={busy}
            autoFocus
            tone="emerald"
            label="Authenticator verification code"
          />

          {notice && <GlassNotice tone={notice.tone}>{notice.text}</GlassNotice>}

          <button
            type="button"
            onClick={() => void verify()}
            disabled={busy || code.replace(/\D/g, "").length !== 6}
            className="security-verify w-full rounded-xl bg-gradient-to-b from-[#00ffa3] to-[#00c97e] px-4 py-3 text-sm font-semibold text-[#04170f] transition hover:from-[#4dffd1] hover:to-[#00e08f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Unlock the studio"}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => void startChallenge()}
              disabled={busy}
              className="text-[#a69eff] transition hover:text-[#e8e6f2] disabled:opacity-50"
            >
              Resend challenge
            </button>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="text-[#9490ac] transition hover:text-[#e8e6f2]"
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
