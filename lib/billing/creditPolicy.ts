/**
 * Server-side credit policy — which catalog row a request is charged at.
 *
 * Pure and dependency-free on purpose: this is the function that decides what
 * a customer pays, so it must be unit-testable in isolation (tests/catalog)
 * and must never read anything the client controls.
 */

/** The default catalog row for each media pipeline. */
export const PIPELINE_DEFAULT_ACTION = {
  image: "image:standard",
  music: "music:standard",
  video: "video:standard",
  voice: "voice:standard",
} as const;

/**
 * Pick what to charge for a request — authoritative, server-side.
 *
 * The tier is derived from the request's own parameters, never trusted from
 * the client: voice is metered by script length (standard covers 500
 * characters, long covers 2500) and every other pipeline charges its standard
 * tier. A client-supplied `creditAction` is honored only when it equals the
 * derived tier — so a hostile caller naming "image:free" (2 cr) for a premium
 * generation, or "voice:standard" (10 cr) for a 2,500-character script, is
 * silently charged the correct catalog price instead of the cheap one.
 */
export function resolveCreditAction(
  pipeline: "image" | "music" | "video" | "voice",
  requested: unknown,
  opts: { scriptChars?: number } = {}
): string {
  let derived: string = PIPELINE_DEFAULT_ACTION[pipeline];
  if (pipeline === "voice") {
    const chars = typeof opts.scriptChars === "number" && opts.scriptChars >= 0 ? opts.scriptChars : 0;
    derived = chars <= 500 ? "voice:standard" : "voice:long";
  }
  if (typeof requested === "string" && requested === derived) return derived;
  return derived;
}
