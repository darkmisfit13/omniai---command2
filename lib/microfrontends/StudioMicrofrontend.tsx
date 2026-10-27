"use client";

import { Component, lazy, Suspense, useMemo, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { MicroModuleSkeleton } from "./Skeleton";
import { ShadowBoundary } from "./ShadowBoundary";

export interface StudioManifestEntry {
  id: string;
  slug: string;
  label: string;
  route: string;
  group: "media" | "creative" | "development" | "archive" | "system";
  accent: string;
  description: string;
  load: () => Promise<{ default: ComponentType<any> }>;
}

const unknownStudio = ({ slug }: { slug?: string }) => (
  <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-sm text-amber-100">
    Unknown micro-frontend module: <span className="font-mono">{slug}</span>
  </div>
);

const failedStudio = ({ error }: { error?: Error }) => (
  <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-6 text-sm text-rose-100">
    <h3 className="font-semibold">Micro-frontend failed to load</h3>
    <p className="mt-2 opacity-80">{error?.message ?? "The module chunk could not be interpolated."}</p>
  </div>
);

export const STUDIO_MICROFRONTEND_MATRIX: StudioManifestEntry[] = [
  { id: "omni-imagine", slug: "image-studio", label: "Omni Imagine", route: "/studio/image-studio", group: "media", accent: "#e879f9", description: "Text-to-image synthesis surfaces", load: () => import("../../app/image-studio/page") },
  { id: "omnimotion", slug: "edit", label: "OmniMotion", route: "/studio/edit", group: "media", accent: "#8b7fff", description: "Timeline editing and export surfaces", load: () => import("../../app/edit/page") },
  { id: "omniwave", slug: "music", label: "OmniWave", route: "/studio/music", group: "media", accent: "#00f2fe", description: "Music generation and transport surfaces", load: () => import("../../app/music/page") },
  { id: "omnibeat", slug: "mv-studio", label: "OmniBeat", route: "/studio/mv-studio", group: "media", accent: "#6ee7b7", description: "Audio-synced music video surfaces", load: () => import("../../app/mv-studio/page") },
  { id: "voice-studio", slug: "voice-studio", label: "OmniVoice", route: "/studio/voice-studio", group: "media", accent: "#ffb84d", description: "Voice cloning and dubbing surfaces", load: () => import("../../app/voice-studio/page") },
  { id: "spatial-3d", slug: "spatial-3d", label: "Spatial 3D Studio", route: "/studio/spatial-3d", group: "media", accent: "#4facfe", description: "Spatial composition surfaces", load: () => import("../../app/spatial-3d/page") },
  { id: "omnicode", slug: "omnicode", label: "OmniCode", route: "/studio/omnicode", group: "development", accent: "#00f2fe", description: "App and web development workspace", load: () => import("../../app/app-builder/page") },
  { id: "app-builder-legacy", slug: "app-builder", label: "OmniCode", route: "/studio/app-builder", group: "development", accent: "#00f2fe", description: "Legacy route for the OmniCode workspace", load: () => import("../../app/app-builder/page") },
  { id: "backend-architect", slug: "backend-architect", label: "Backend Architect", route: "/studio/backend-architect", group: "development", accent: "#4facfe", description: "Schema and API design surfaces", load: () => import("../../app/backend-architect/page") },
  { id: "cosmic-ui-lab", slug: "ui-lab", label: "Cosmic UI Lab", route: "/studio/ui-lab", group: "development", accent: "#e879f9", description: "Interface generation and styling surfaces", load: () => import("../../app/ui-lab/page") },
  { id: "api-connector", slug: "api-connector", label: "API & Webhook Lab", route: "/studio/api-connector", group: "development", accent: "#00f2fe", description: "Webhook and integration surfaces", load: () => import("../../app/api-connector/page") },
  { id: "storyboard", slug: "storyboard", label: "OmniStoryboard", route: "/studio/storyboard", group: "creative", accent: "#a69eff", description: "Script and scene planning surfaces", load: () => import("../../app/storyboard/page") },
  { id: "vector-lab", slug: "vector-graphics", label: "Vector & Brand Lab", route: "/studio/vector-graphics", group: "creative", accent: "#e879f9", description: "Vector geometry and branding surfaces", load: () => import("../../app/vector-graphics/page") },
  { id: "viral-mockup", slug: "viral-mockup", label: "Viral Mockup", route: "/studio/viral-mockup", group: "creative", accent: "#fb7185", description: "Social simulation surfaces", load: () => import("../../app/viral-mockup/page") },
  { id: "face-swap", slug: "face-swap", label: "OmniStyle", route: "/studio/face-swap", group: "creative", accent: "#fcd34d", description: "Digital costume and swap surfaces", load: () => import("../../app/face-swap/page") },
  { id: "media-vault", slug: "assets", label: "Media Library", route: "/studio/assets", group: "archive", accent: "#ffb84d", description: "Vault browsing and asset archive surfaces", load: () => import("../../app/assets/page") },
  { id: "pricing-upgrade", slug: "pricing", label: "Pricing & Credits", route: "/studio/pricing", group: "system", accent: "#6c63ff", description: "Plan and upgrade surfaces", load: () => import("../../app/pricing/page") },
  { id: "call-hud", slug: "call", label: "Call HUD · Council", route: "/studio/call", group: "system", accent: "#0C00CA", description: "Live Tri-Agent Call and Council Performance HUD", load: () => import("../../app/call/page") },
];

export const STUDIO_MICROFRONTEND_LOADERS = Object.fromEntries(
  STUDIO_MICROFRONTEND_MATRIX.map((entry) => [entry.slug, entry.load]),
) as Record<string, () => Promise<{ default: ComponentType<any> }>>;

export function getStudioManifestEntry(slug: string) {
  return STUDIO_MICROFRONTEND_MATRIX.find((entry) => entry.slug === slug) ?? null;
}

export function resolveStudioLoader(slug: string) {
  const entry = getStudioManifestEntry(slug);
  if (!entry) return null;
  return entry.load;
}

class StudioMicrofrontendErrorBoundary extends Component<{ children: ReactNode; slug: string }, { error: Error | null }> {
  constructor(props: { children: ReactNode; slug: string }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (typeof console !== "undefined") console.error("[microfrontend]", error);
  }

  render() {
    if (this.state.error) return failedStudio({ error: this.state.error });
    return this.props.children;
  }
}

export interface DynamicStudioProps {
  slug: string;
  shadow?: boolean;
  className?: string;
  skeletonLabel?: string;
}

export function DynamicStudio({ slug, shadow = false, className, skeletonLabel }: DynamicStudioProps) {
  const entry = getStudioManifestEntry(slug);
  const LazyComponent = useMemo(() => {
    const fallbackSlug = slug;
    return lazy(async () => {
      const loader = STUDIO_MICROFRONTEND_LOADERS[slug];
      if (!loader) {
        return {
          default: () => unknownStudio({ slug: fallbackSlug }),
        };
      }
      try {
        const loadedModule = await loader();
        if (loadedModule && typeof loadedModule.default === "function") return loadedModule;
        return { default: () => unknownStudio({ slug: fallbackSlug }) };
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        return {
          default: () => failedStudio({ error: failure }),
        };
      }
    });
  }, [slug]);

  const content = (
    <StudioMicrofrontendErrorBoundary slug={slug}>
      <Suspense fallback={<MicroModuleSkeleton label={skeletonLabel ?? entry?.label ?? slug} accent={entry?.accent} />}>
        <LazyComponent />
      </Suspense>
    </StudioMicrofrontendErrorBoundary>
  );

  if (shadow) {
    return (
      <ShadowBoundary className={className} title={entry?.label ?? slug}>
        {content}
      </ShadowBoundary>
    );
  }

  return <div className={className}>{content}</div>;
}

export const StudioMicrofrontend = DynamicStudio;
export const MicrofrontendHost = DynamicStudio;
export const LazyStudio = DynamicStudio;
export const StudioRenderer = DynamicStudio;

// Compat alias kept separately to avoid a circular component file.
export { DynamicRouteMatrixSkeleton } from "./Skeleton";