import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared frame for the legal pages.
 *
 * They are plain documents on purpose: no depth tilt, no panels, no motion.
 * Somebody reading a refund policy should not have to fight the interface to
 * do it, and a policy that renders differently depending on whether the
 * reader's device honours reduced-motion is not a policy.
 */

export const SELLER = "Benjamin Cody James, trading as DarkMisfitStudios";
export const UPDATED = "October 14, 2026";

export function LegalFooter() {
  return (
    <footer className="mt-12 flex flex-wrap gap-4 border-t border-[var(--hud-border)] pt-6 text-xs text-ink/50">
      <span>© 2026 DarkMisfitStudios</span>
      <Link href="/pricing" className="hover:text-ink">
        Pricing
      </Link>
      <Link href="/terms" className="hover:text-ink">
        Terms
      </Link>
      <Link href="/refund-policy" className="hover:text-ink">
        Refund Policy
      </Link>
      <Link href="/privacy" className="hover:text-ink">
        Privacy
      </Link>
    </footer>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <Link href="/" className="text-xs text-ash hover:text-ink">
        ← OmniAI
      </Link>

      <header className="mt-6">
        <h1 className="pilot-voice text-3xl">{title}</h1>
        <p className="mt-2 text-xs text-ink/50">Last updated {UPDATED}</p>
      </header>

      <div className="mt-8 space-y-4 text-sm leading-relaxed text-ash [&_a]:text-[var(--hud-bright)] [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>

      <LegalFooter />
    </div>
  );
}
