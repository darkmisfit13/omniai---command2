"use client";

import Link from "next/link";
import { environmentAreas } from "@/lib/environment-areas";

/**
 * Personal environment — the full list of tool areas the workspace connects
 * to. The dashboard keeps a monitoring card for most of these and a pressable
 * gauge for Approval Safeguards; this page is where the whole environment is
 * laid out in one place, with each area's own page behind it.
 */
export default function EnvironmentPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="dms-mono text-[10px] tracking-[0.24em] text-[#8d7fae]">
          WORKSPACE / ENVIRONMENT
        </p>
        <h2 className="pilot-voice text-2xl">Personal environment</h2>
        <p className="text-sm text-ash">
          The tool areas OmniAI connects to for you. Each area links to its own
          page, where available.
        </p>
      </header>

      <ol className="space-y-3">
        {environmentAreas.map((area) => (
          <li
            className="rounded-xl border border-[#443253] bg-[linear-gradient(145deg,#120e1c,#0b0a12)] p-4 shadow-[inset_0_1px_#ffffff05,0_8px_28px_#00000012]"
            key={area.number}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="dms-mono text-[10px] tracking-[0.2em] text-[#8d7fae]">
                  {area.number} · {area.eyebrow}
                </p>
                <h3 className="text-sm font-semibold text-[#e9e2fa]">
                  {area.title}
                </h3>
                <p className="text-xs text-ash">{area.description}</p>
              </div>

              <Link
                className="dms-mono shrink-0 rounded-lg border border-[#906fc754] bg-[#6949a81a] px-3 py-1.5 text-[10px] font-bold text-[#c7b6ed] transition-colors hover:border-[#b092ff9e] hover:bg-[#7952c733]"
                href={area.href}
              >
                {area.action} ↗
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-ash">
        The dashboard gauges show live status for local AI, the database, and
        approval safeguards.{" "}
        <Link className="text-signal underline-offset-2 hover:underline" href="/dashboard">
          Back to the dashboard
        </Link>
        .
      </p>
    </div>
  );
}
