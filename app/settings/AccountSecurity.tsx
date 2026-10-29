"use client";

import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import StatusPill from "@/app/hud/StatusPill";
import GlassNotice, { type NoticeTone } from "@/app/components/GlassNotice";
import TwoFactorSetupModal from "./TwoFactorSetupModal";

type Notice = { tone: NoticeTone; text: string } | null;

const fieldClass =
  "bg-transparent border border-ash/40 rounded px-3 py-2 outline-none focus:border-signal w-full";
const buttonClass =
  "bg-wine text-ink px-4 py-2 rounded hover:bg-wine/80 disabled:opacity-50 disabled:cursor-not-allowed";
const smallButtonClass =
  "text-xs text-signal hover:underline disabled:opacity-50 disabled:no-underline";

/**
 * Change password + two-factor authentication for the signed-in account.
 * Everything here runs through the user's own session — no admin key —
 * so it is safe for every account, not just the owner.
 *
 * Enabling 2FA hands off to `TwoFactorSetupModal`, which runs the full TOTP
 * enrollment (QR + backup secret + live verification). This section owns the
 * account's factor state and the disable path.
 */
export default function AccountSecurity() {
  const [factor, setFactor] = useState<Factor | null>(null);

  // Change-password form.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);

  // Two-factor status + teardown.
  const [setupOpen, setSetupOpen] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaNotice, setMfaNotice] = useState<Notice>(null);

  const refreshFactors = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    // The totp bucket only contains verified factors.
    setFactor(data?.totp[0] ?? null);
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const handleEnabled = useCallback(() => {
    setSetupOpen(false);
    setMfaNotice({
      tone: "success",
      text: "Two-factor authentication is on. You'll enter a code from your app each time you sign in.",
    });
    void refreshFactors();
  }, [refreshFactors]);

  function openSetup() {
    setMfaNotice(null);
    setSetupOpen(true);
  }

  async function changePassword() {
    setPasswordNotice(null);
    if (!currentPassword) {
      setPasswordNotice({ tone: "error", text: "Enter your current password." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordNotice({ tone: "error", text: "The new password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ tone: "error", text: "The new passwords do not match." });
      return;
    }

    setPasswordBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Your sign-in expired. Sign in again.");

      // With 2FA on, only a fully verified (AAL2) session may change the password.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        throw new Error("Finish two-factor sign-in before changing your password.");
      }

      const response = await fetch("/api/account/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password: currentPassword }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        valid?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not verify your current password.");
      if (!payload.valid) throw new Error("Your current password is not correct.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice({ tone: "success", text: "Password updated. Use it the next time you sign in." });
    } catch (error) {
      setPasswordNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not change the password.",
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function disable2fa() {
    if (!factor) return;
    if (
      !window.confirm(
        "Turn off two-factor authentication? From then on only your password protects this account."
      )
    ) {
      return;
    }

    setMfaBusy(true);
    setMfaNotice(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw new Error(error.message);
      await refreshFactors();
      setMfaNotice({ tone: "info", text: "Two-factor authentication is off." });
    } catch (error) {
      setMfaNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not turn off two-factor authentication.",
      });
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <div className="space-y-8 border-t border-ash/20 pt-8">
      <div>
        <h3 className="text-sm text-ash mb-1">Change password</h3>
        <p className="text-xs text-ash mb-3">
          Confirm your current password, then choose a new one (at least 8 characters).
        </p>
        <div className="max-w-sm space-y-2">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            className={fieldClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            className={fieldClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            className={fieldClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void changePassword()}
          />
          <button onClick={() => void changePassword()} disabled={passwordBusy} className={buttonClass}>
            {passwordBusy ? "Updating..." : "Update password"}
          </button>
          {passwordNotice && <GlassNotice tone={passwordNotice.tone}>{passwordNotice.text}</GlassNotice>}
        </div>
      </div>

      <div className="dms-rim-light dms-grain rounded-2xl border border-[#211d34] bg-[#14121f]/85 p-5 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm text-ash mb-1">Two-factor authentication</h3>
            <p className="text-xs text-ash max-w-md">
              After your password, sign-in also asks for a 6-digit code from an authenticator app
              (Google Authenticator, Authy, 1Password…).
            </p>
          </div>
          <StatusPill label={factor ? "Secured" : "Not set"} tone={factor ? "ok" : "idle"} />
        </div>

        {factor ? (
          <div className="space-y-1">
            <p className="text-sm text-[#c5bfff]">
              Authenticator app active
              {factor.friendly_name ? ` — ${factor.friendly_name}` : ""}
            </p>
            <button onClick={() => void disable2fa()} disabled={mfaBusy} className={smallButtonClass}>
              {mfaBusy ? "Disabling…" : "Turn off two-factor authentication"}
            </button>
          </div>
        ) : (
          <button onClick={openSetup} disabled={mfaBusy} className={buttonClass}>
            Enable 2FA
          </button>
        )}

        {mfaNotice && (
          <div className="mt-3">
            <GlassNotice tone={mfaNotice.tone}>{mfaNotice.text}</GlassNotice>
          </div>
        )}
      </div>

      {setupOpen && (
        <TwoFactorSetupModal onClose={() => setSetupOpen(false)} onEnabled={handleEnabled} />
      )}
    </div>
  );
}
