type Tone = "accent" | "ok" | "warn" | "stream";

const colors: Record<Tone, string> = {
  accent: "#8b7fff",
  ok: "#00ffa3",
  warn: "#ff2a6d",
  stream: "#00f2fe",
};

export default function GaugeArc({
  value,
  label,
  detail,
  tone = "accent",
}: {
  value: number;
  label: string;
  detail?: string;
  tone?: Tone;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = 42;
  const circumference = Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = colors[tone];

  return (
    <div className="flex flex-col items-center text-center">
      <svg
        viewBox="0 0 120 78"
        className="h-[78px] w-[120px] drop-shadow-[0_0_12px_rgba(108,99,255,0.28)]"
        role="img"
        aria-label={`${label}: ${Math.round(clamped)} percent`}
      >
        <path
          d="M18 64 A42 42 0 0 1 102 64"
          fill="none"
          stroke="#211d34"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M18 64 A42 42 0 0 1 102 64"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text
          x="60"
          y="58"
          textAnchor="middle"
          fill="#e8e6f2"
          fontSize="18"
          fontWeight="700"
        >
          {Math.round(clamped)}
        </text>
      </svg>
      <p className="hud-kicker mt-1">{label}</p>
      {detail && (
        <p className="mt-1 max-w-[11rem] text-[11px] leading-4 text-hud-muted">
          {detail}
        </p>
      )}
    </div>
  );
}
