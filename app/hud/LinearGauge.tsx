type Tone = "accent" | "ok" | "warn" | "stream";

const fills: Record<Tone, string> = {
  accent: "from-[#6c63ff] to-[#8b7fff]",
  ok: "from-[#00ffa3] to-[#4facfe]",
  warn: "from-[#ff2a6d] to-[#8b7fff]",
  stream: "from-[#00f2fe] to-[#4facfe]",
};

export default function LinearGauge({
  value,
  label,
  tone = "accent",
}: {
  value: number;
  label: string;
  tone?: Tone;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs text-hud-muted">{label}</span>
        <span className="text-xs font-semibold text-hud-ink">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#0b0a14] ring-1 ring-hud-border">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fills[tone]} shadow-[0_0_12px_rgba(108,99,255,0.35)]`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
