import type { ReactNode } from "react";

/**
 * A small glass status strip used by the security surfaces (2FA setup + the
 * sign-in verification overlay). It follows the app's dark tech theme: a
 * translucent, blurred plaque with a signal-coloured rim and an inline glyph.
 */
export type NoticeTone = "info" | "success" | "error" | "working";

const TONE: Record<NoticeTone, string> = {
  info: "border-[#8b7fff]/45 bg-[#8b7fff]/10 text-[#c5bfff]",
  success: "border-[#00ffa3]/45 bg-[#00ffa3]/10 text-[#aefce4]",
  error: "border-[#ff2a6d]/45 bg-[#ff2a6d]/[0.12] text-[#ffb3cf]",
  working: "border-[#00f2fe]/40 bg-[#00f2fe]/10 text-[#c9f7ff]",
};

const GLYPH: Record<Exclude<NoticeTone, "working">, ReactNode> = {
  info: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6h.01" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.6 21 19.5H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  ),
};

export default function GlassNotice({
  tone,
  children,
  className = "",
}: {
  tone: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm leading-5 backdrop-blur-md ${TONE[tone]} ${className}`.trim()}
    >
      <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {tone === "working" ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          GLYPH[tone]
        )}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
