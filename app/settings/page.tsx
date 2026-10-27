"use client";

import Link from "next/link";
import AccountSecurity from "./AccountSecurity";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8 bg-[#000000] p-2 sm:p-4">
      <header>
        <h1 className="pilot-voice text-2xl text-white">Settings</h1>
        <p className="mt-1 text-sm text-[#8d87a8]">Account security and personal billing preferences.</p>
      </header>

      <section className="rounded-2xl border border-[#1f1638] bg-[#0a071b] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-[#f1f0f7]">AI Director persona</h2>
              <span className="rounded-full border border-[#00ffff]/40 bg-[#00ffff]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#00ffff]">Core locked</span>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#8d87a8]">
              OmniAI’s DarkMisfitStudios voice and creative direction are managed by the server orchestration layer. They cannot be changed from account settings.
            </p>
          </div>
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-[#0C00CA]/40 bg-[#0C00CA]/15 text-[#00ffff] shadow-[0_0_12px_rgba(12,0,202,0.3)]">◈</span>
        </div>
      </section>

      <AccountSecurity />

      <section className="rounded-2xl border border-[#1f1638] bg-[#0a071b] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[#f1f0f7]">Billing &amp; Plans</h2>
            <p className="mt-1 text-xs text-[#8d87a8]">
              Manage your subscription, scheduled plan changes, and credit packs.
            </p>
          </div>
          <Link href="/settings/billing" className="hud-btn text-xs hover:border-[#0C00CA] hover:shadow-[0_0_15px_rgba(12,0,202,0.4)]">
            Open Billing &amp; Plans
          </Link>
        </div>
      </section>
    </div>
  );
}
