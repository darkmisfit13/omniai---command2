"use client";

import { useParams } from "next/navigation";
import { DynamicStudio, getStudioManifestEntry } from "@/lib/microfrontends";
import { StudioShadowBoundary } from "@/lib/microfrontends/ShadowBoundary";

export default function StudioMicrofrontendRoutePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "";

  const entry = slug ? getStudioManifestEntry(slug) : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a69eff]">
          Studio
        </p>
        <h1 className="text-2xl font-bold text-[#e8e6f2] sm:text-3xl">
          {entry?.label ?? "Studio"}
        </h1>
        {entry?.description && (
          <p className="max-w-3xl text-sm leading-6 text-[#9490ac]">{entry.description}</p>
        )}
      </header>

      {slug ? (
        <StudioShadowBoundary title={slug}>
          <DynamicStudio slug={slug} />
        </StudioShadowBoundary>
      ) : (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-sm text-amber-100">
          No studio module was requested.
        </div>
      )}
    </div>
  );
}