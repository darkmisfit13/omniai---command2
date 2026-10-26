type Tone = "idle" | "ok" | "warn" | "busy" | "accent";

const tones: Record<Tone, string> = {
  idle: "border-hud-border text-hud-muted",
  ok: "border-[color:var(--hud-ok)]/40 text-[color:var(--hud-ok)]",
  warn: "border-[color:var(--hud-warn)]/40 text-[color:var(--hud-warn)]",
  busy: "border-cyan-400/40 text-cyan-300",
  accent: "border-hud-accent/40 text-hud-bright",
};

const dots: Record<Tone, string> = {
  idle: "bg-hud-muted",
  ok: "bg-[color:var(--hud-ok)] shadow-[0_0_10px_rgba(0,255,163,0.7)]",
  warn: "bg-[color:var(--hud-warn)] shadow-[0_0_10px_rgba(255,42,109,0.7)]",
  busy: "bg-cyan-300 shadow-[0_0_10px_rgba(0,242,254,0.7)]",
  accent: "bg-hud-bright shadow-[0_0_10px_rgba(139,127,255,0.7)]",
};

export default function StatusPill({
  label,
  tone = "idle",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
      {label}
    </span>
  );
}
