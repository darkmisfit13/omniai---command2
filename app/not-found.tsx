"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center space-y-6 rounded-2xl border border-[#30294c] bg-[#14121f] p-10 shadow-[0_20px_70px_rgba(0,0,0,.3)]">
        <p className="text-6xl font-extrabold tracking-tight text-[#f4f1ff]">404</p>
        <p className="text-lg text-[#9490ac]">This page doesn&apos;t exist — or it drifted into the void.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6c63ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(108,99,255,.25)] hover:bg-[#7a71ff] transition"
        >
          Back to OmniAI
        </Link>
      </div>
    </div>
  );
}