"use client";

import Link from "next/link";
import AccountSecurity from "./AccountSecurity";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="pilot-voice text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-ash">Account security and personal billing preferences.</p>
      </header>

      <section className="rounded-2xl border border-[#211d34] bg-[#14121f]/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-[#e8e6f2]">AI Director persona</h2>
              <span className="rounded-full border border-[#6c63ff]/40 bg-[#6c63ff]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#c5bfff]">Core locked</span>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#9490ac]">
              OmniAI’s DarkMisfitStudios voice and creative direction are managed by the server orchestration layer. They cannot be changed from account settings.
            </p>
          </div>
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-[#6c63ff]/30 bg-[#6c63ff]/10 text-[#c5bfff]">◈</span>
        </div>
      </section>

      <AccountSecurity />

      <section className="rounded-2xl border border-[#211d34] bg-[#14121f]/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[#e8e6f2]">Billing &amp; Plans</h2>
            <p className="mt-1 text-xs text-[#9490ac]">
              Manage your subscription, scheduled plan changes, and credit packs.
            </p>
          </div>
          <Link href="/settings/billing" className="hud-btn text-xs">
            Open Billing &amp; Plans
          </Link>
        </div>
      </section>
    </div>
  );
}
