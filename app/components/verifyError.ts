/**
 * Translate a raw Supabase MFA error into a clear, on-brand message.
 * Challenges are single-use and short-lived, and GoTrue rate-limits repeated
 * failures, so those cases get their own plain-language wording.
 */
export function friendlyVerifyError(message: string): string {
  const lower = (message || "").toLowerCase();
  if (lower.includes("expired")) {
    return "That code expired. Open your authenticator app and enter the current 6-digit code.";
  }
  if (lower.includes("too many") || lower.includes("rate")) {
    return "Too many attempts. Wait a moment, then enter the newest code from your app.";
  }
  if (
    lower.includes("invalid") ||
    lower.includes("not valid") ||
    lower.includes("incorrect") ||
    lower.includes("mismatch")
  ) {
    return "That code was not accepted. Check your authenticator app and try the current code.";
  }
  return message || "That code was not accepted. Please try again.";
}
