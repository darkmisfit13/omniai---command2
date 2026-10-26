"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

/**
 * A six-cell numeric code input for authenticator tokens. Each cell is its own
 * focusable field so the layout reads as a clean verification box, while typing
 * and paste both flow digit-by-digit. `onComplete` fires the moment the sixth
 * digit lands, which the callers use to auto-submit.
 */
type Tone = "emerald" | "violet";

const BOX_TONE: Record<Tone, string> = {
  emerald:
    "border-[#211d34] bg-[#0b0a14] focus:border-[#00ffa3]/80 focus:bg-[#00ffa3]/[0.06] focus:shadow-[0_0_0_3px_rgba(0,255,163,0.16),0_0_22px_rgba(0,255,163,0.28)]",
  violet:
    "border-[#211d34] bg-[#0b0a14] focus:border-[#8b7fff]/75 focus:bg-[#8b7fff]/[0.06] focus:shadow-[0_0_0_3px_rgba(139,127,255,0.16)]",
};

export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  tone = "emerald",
  label = "6-digit verification code",
}: {
  value: string;
  onChange: (digits: string) => void;
  onComplete?: (digits: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  tone?: Tone;
  label?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, "").slice(0, 6);

  // Focus the next empty cell once, on mount. Later value changes must never
  // steal the caret while someone is typing.
  useEffect(() => {
    if (!autoFocus) return;
    const target = Math.min(digits.length, 5);
    const id = window.setTimeout(() => refs.current[target]?.focus(), 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  function commit(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.min(Math.max(focusIndex, 0), 5)]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) {
      // Backspace over an empty cell, or a cleared cell: drop it and compact.
      const next = digits.split("");
      next.splice(index, 1);
      commit(next.join(""), index - 1);
      return;
    }
    const cells = (digits + " ".repeat(6)).slice(0, 6).split("");
    for (let i = 0; i < typed.length && index + i < 6; i += 1) {
      cells[index + i] = typed[i];
    }
    commit(cells.join("").replace(/\s+/g, ""), index + typed.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index]) {
      event.preventDefault();
      const next = digits.split("");
      next.splice(Math.max(index - 1, 0), 1);
      commit(next.join(""), index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      refs.current[Math.max(index - 1, 0)]?.focus();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      refs.current[Math.min(index + 1, 5)]?.focus();
    }
  }

  return (
    <div role="group" aria-label={label} className="flex items-center justify-center gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={digits[index] ?? ""}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={6}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of 6`}
          className={`h-12 w-10 rounded-lg border text-center font-mono text-xl text-[#e8e6f2] outline-none transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-12 ${BOX_TONE[tone]}`}
        />
      ))}
    </div>
  );
}
