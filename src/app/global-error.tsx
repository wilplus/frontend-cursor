"use client";

import { useEffect } from "react";

/* -------------------------------------------------------------------------- */
/*  global-error — the boundary of last resort: only a throw in the ROOT       */
/*  layout itself lands here, replacing it entirely. That is why this file     */
/*  renders its own <html>/<body> and styles inline — when the root layout is  */
/*  down, globals.css and the Tailwind pipeline may be down with it, so        */
/*  nothing here may depend on them. Copy matches ErrorState exactly.          */
/* -------------------------------------------------------------------------- */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#111111",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          textAlign: "center",
          padding: "4rem 1.5rem",
        }}
      >
        <div role="alert" style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#666666",
              margin: "0.5rem 0 1.5rem",
            }}
          >
            Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              font: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #dddddd",
              background: "#111111",
              color: "#ffffff",
              cursor: "pointer",
              marginRight: "0.75rem",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              display: "inline-block",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #dddddd",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            Go home
          </a>
          {error?.digest ? (
            <p style={{ fontSize: "11px", color: "#999999", marginTop: "1.5rem" }}>
              Error reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
