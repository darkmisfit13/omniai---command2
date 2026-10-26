"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root-level error boundary for the OmniAI app router.
 *
 * Any unhandled render error in a route segment would otherwise unmount the
 * whole React tree and leave the browser showing a blank white page. This
 * boundary catches it and renders a recoverable, themed fallback instead, so a
 * single failing component can never take down the entire interface.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for diagnostics; never print secrets — only the message + digest.
    console.error("[OmniAI] route error:", error?.message, error?.digest);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0b0a14",
        color: "#e8e6f2",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          background: "#14121f",
          border: "1px solid #211d34",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 18px 42px rgba(108,99,255,0.18)",
        }}
      >
        <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "13px", color: "#9490ac", marginTop: "8px", lineHeight: 1.5 }}>
          OmniAI hit an unexpected error while rendering this page. The rest of the
          application is unaffected — you can retry, or navigate back to the dashboard.
        </p>
        {error?.message ? (
          <pre
            style={{
              marginTop: "12px",
              padding: "10px",
              background: "#0b0a14",
              border: "1px solid #211d34",
              borderRadius: "8px",
              fontSize: "11px",
              color: "#fda4af",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "120px",
              overflow: "auto",
            }}
          >
            {error.message}
          </pre>
        ) : null}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "linear-gradient(135deg, #5b39b4, #6c63ff)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            style={{
              background: "#14121f",
              color: "#c5bfff",
              border: "1px solid #211d34",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}