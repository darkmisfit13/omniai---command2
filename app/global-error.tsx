"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Global error boundary — catches errors thrown by the root layout itself
 * (which `app/error.tsx` cannot catch). Renders its own <html>/<body> so the
 * screen is never fully blank.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OmniAI] global error:", error?.message, error?.digest);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
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
          }}
        >
          <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
            OmniAI encountered an error
          </h1>
          <p style={{ fontSize: "13px", color: "#9490ac", marginTop: "8px", lineHeight: 1.5 }}>
            The application hit an unexpected problem. You can retry, or reload the page.
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
              href="/"
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
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}