"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import NeuralCore from "@/app/hud/NeuralCore";
import GlassNotice, { type NoticeTone } from "@/app/components/GlassNotice";
import OtpInput from "@/app/components/OtpInput";
import { friendlyVerifyError } from "@/app/components/verifyError";

/**
 * The two-factor setup dashboard modal.
 *
 * Opening it starts a real TOTP enrollment (`mfa.enroll`), renders the QR data
 * string Supabase returns into a framed visual plus a copyable backup secret,
 * then finalises the factor with a live `mfa.challenge` + `mfa.verify`. Any
 * half-finished factor is cleaned up on close so the account is never left with
 * a dangling unverified registration.
 */

type Enrollment = { factorId: string; qrCode: string; secret: string };
type Notice = { tone: NoticeTone; text: string } | null;
type Phase = "loading" | "ready" | "activating" | "done";

/** The QR Supabase returns is a raw SVG inside a data URI; re-encode the
 *  payload so every browser will render it in an <img src>. */
function qrImageSrc(qr: string) {
  const comma = qr.indexOf(",");
  if (comma === -1) return qr;
  const header = qr.slice(0, comma);
  const payload = qr.slice(comma + 1);
  let svg = payload;
  try {
    svg = decodeURIComponent(payload);
  } catch {
    // keep raw payload
  }
  return `${header},${encodeURIComponent(svg)}`;
}

export default function TwoFactorSetupModal({
  onClose,
  onEnabled,
}: {
  onClose: () => void;
  onEnabled: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState(false);

  const startedRef = useRef(false);
  const pendingFactorRef = useRef<string | null>(null);
  const settledRef = useRef(false);

  const busy = phase === "activating";
  const done = phase === "done";

  const startEnroll = useCallback(async () => {
    setPhase("loading");
    setNotice({ tone: "working", text: "Opening a secure enrollment channel…" });
    try {
      // Clean up any half-finished setup from a previous attempt first so the
      // account never accumulates unverified factors.
      const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw new Error(listError.message);
      for (const stale of (existing?.all ?? []).filter((f: Factor) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error || !data?.totp) {
        throw new Error(error?.message ?? "Could not start two-factor setup.");
      }

      pendingFactorRef.current = data.id;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
      setPhase("ready");
      setNotice(null);
    } catch (error) {
      setPhase("ready");
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not start two-factor setup.",
      });
    }
  }, []);

  useEffect(() => {
    // Guard against React StrictMode's double-invoked effect in development.
    if (startedRef.current) return;
    startedRef.current = true;
    void startEnroll();
  }, [startEnroll]);

  const handleClose = useCallback(() => {
    const factorId = pendingFactorRef.current;
    if (factorId && !settledRef.current) {
      // Best-effort teardown of the not-yet-verified factor.
      void supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
      pendingFactorRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Escape closes; the page behind must not scroll while the modal is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleClose]);

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice({
        tone: "error",
        text: "Could not copy automatically — select the key and copy it manually.",
      });
    }
  }

  async function activate(raw = code) {
    if (!enrollment || busy || done) return;
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 6) {
      setNotice({ tone: "error", text: "Enter the 6-digit code from your authenticator app." });
      return;
    }

    setPhase("activating");
    setNotice({ tone: "working", text: "Verifying your code…" });
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (challengeError || !challenge) {
        throw new Error(challengeError?.message ?? "Could not start verification. Try again.");
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: digits,
      });
      if (verifyError) throw new Error(friendlyVerifyError(verifyError.message));

      settledRef.current = true;
      setCode("");
      setPhase("done");
      setNotice({ tone: "success", text: "Two-factor authentication is active. You're all set." });
      // Let the success state breathe, then hand control back to Settings.
      window.setTimeout(onEnabled, 900);
    } catch (error) {
      setPhase("ready");
      setCode("");
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "That code was not accepted. Try again.",
      });
    }
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-[#05040a]/85 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-factor-title"
    >
      <div className="dms-rim-light dms-grain relative flex max-h-[94vh] w-[min(580px,95vw)] flex-col overflow-hidden rounded-2xl border border-[#2a2444] bg-[#14121f]/95 shadow-[0_40px_130px_-40px_rgba(108,99,255,0.65)] backdrop-blur-2xl">
        {/* WebGL accent banner — the enrollment "signal". */}
        <div className="relative h-28 shrink-0 overflow-hidden border-b border-[#211d34] bg-[radial-gradient(ellipse_at_50%_125%,rgba(0,255,163,0.18),transparent_62%)]">
          <NeuralCore
            className="pointer-events-none absolute inset-0 block h-full w-full opacity-80"
            levels={[0.7, 0.42, 0.9]}
            colors={["#8b7fff", "#00ffa3", "#00f2fe"]}
            active={phase === "loading" || phase === "activating" || phase === "done"}
            pulse={phase === "activating" || phase === "done"}
            label="Two-factor enrollment visualization"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#14121f] via-[#14121f]/25 to-transparent" />
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-[#393252] bg-[#0b0a14]/70 text-[#9490ac] transition hover:text-white"
          >
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-3 px-5">
            <p className="dms-mono text-[10px] tracking-[0.32em] text-[#a69eff]">ACCOUNT SECURITY</p>
            <h2 id="two-factor-title" className="text-lg font-semibold text-[#e8e6f2]">
              Two-Factor Authentication
            </h2>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {notice && <GlassNotice tone={notice.tone}>{notice.text}</GlassNotice>}

          {phase === "loading" && (
            <div className="space-y-3 py-6">
              <div className="mx-auto h-44 w-44 animate-pulse rounded-xl border border-[#211d34] bg-[#0b0a14]" />
              <div className="mx-auto h-3 w-52 animate-pulse rounded bg-[#211d34]" />
              <div className="mx-auto h-3 w-40 animate-pulse rounded bg-[#211d34]" />
            </div>
          )}

          {phase !== "loading" && enrollment && (
            <>
              <ol className="space-y-1 text-xs leading-5 text-[#9490ac]">
                <li>
                  <span className="text-[#c5bfff]">1.</span> Scan the QR code with your authenticator
                  app (Google Authenticator, Authy, 1Password…).
                </li>
                <li>
                  <span className="text-[#c5bfff]">2.</span> Enter the 6-digit code it shows to
                  activate two-factor sign-in.
                </li>
              </ol>

              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="security-qr shrink-0 rounded-xl border border-[#2a2444] bg-white p-3 shadow-[0_0_34px_rgba(108,99,255,0.28)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageSrc(enrollment.qrCode)}
                    alt="Two-factor setup QR code"
                    className="h-40 w-40"
                  />
                </div>

                <div className="w-full min-w-0 space-y-2">
                  <p className="dms-mono text-[10px] tracking-[0.2em] text-[#9490ac]">
                    CAN&apos;T SCAN? ENTER THIS KEY MANUALLY
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-[#211d34] bg-[#0b0a14] p-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-4 text-[#4dffd1]">
                      {enrollment.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copySecret()}
                      className="shrink-0 rounded-md border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-2.5 py-1 text-[11px] font-semibold text-[#aefce4] transition hover:bg-[#00ffa3]/20 disabled:opacity-60"
                      disabled={done}
                    >
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] leading-4 text-[#716c8b]">
                    Keep this key private — it can generate codes for your account.
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#211d34] pt-4">
                <p className="text-center text-xs text-[#9490ac]">Enter the current 6-digit code</p>
                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={(digits) => void activate(digits)}
                  disabled={busy || done}
                  autoFocus
                  tone="emerald"
                  label="Authenticator verification code"
                />
                <button
                  type="button"
                  onClick={() => void activate()}
                  disabled={busy || done || code.replace(/\D/g, "").length !== 6}
                  className="security-verify w-full rounded-xl bg-gradient-to-b from-[#00ffa3] to-[#00c97e] px-4 py-3 text-sm font-semibold text-[#04170f] transition hover:from-[#4dffd1] hover:to-[#00e08f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Activating…" : done ? "Activated ✓" : "Verify and Activate"}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={busy}
                    className="text-xs text-[#9490ac] hover:text-[#e8e6f2] disabled:opacity-50"
                  >
                    Cancel setup
                  </button>
                </div>
              </div>
            </>
          )}

          {phase !== "loading" && !enrollment && (
            <div className="space-y-3 py-2 text-center">
              <button
                type="button"
                onClick={() => void startEnroll()}
                className="d3-btn d3-btn--primary mx-auto"
              >
                Retry setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
