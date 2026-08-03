"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  ErrorState — the ONE render-error fallback across the app.                 */
/*                                                                            */
/*  The counterpart to LoadingState: every route-level error.tsx renders this  */
/*  and nothing else, so a throw anywhere looks like this product instead of   */
/*  Next's default white screen. To change the look everywhere, change it      */
/*  HERE only.                                                                */
/*                                                                            */
/*  The read is strictly qualitative (AC-9): a static voice mark, the same     */
/*  "Something went wrong. Please try again." line the auth flows already      */
/*  ship, a retry, and a way home. The digest is Next's opaque server-error    */
/*  reference — an opaque support handle, never a score or diagnostic shown    */
/*  as meaning.                                                               */
/* -------------------------------------------------------------------------- */

/** The voice mark, still. The breathing rings belong to waiting; an error
 *  holds the dots without the motion. */
function StillVoiceMark({ size }: { size: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full border border-foreground/10"
      style={{ height: size, width: size }}
      aria-hidden="true"
    >
      <svg
        width={Math.round(size * 0.42)}
        height={Math.round(size * 0.42)}
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <circle cx="12" cy="28" r="4" fill="hsl(var(--foreground) / 0.5)" />
        <circle cx="28" cy="28" r="6" fill="hsl(var(--foreground) / 0.5)" />
        <circle cx="44" cy="28" r="4" fill="hsl(var(--foreground) / 0.5)" />
      </svg>
    </div>
  );
}

export default function ErrorState({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  /** Next's boundary reset — re-renders the failed segment. */
  reset?: () => void;
}) {
  useEffect(() => {
    // No telemetry sink exists yet; the console is where a reproduced error
    // gets read today. Route through here so adding a sink later is one edit.
    if (error) console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60dvh] w-full flex-1 items-center justify-center px-6 py-16"
    >
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <StillVoiceMark size={64} />
        {/* Heading + body together are exactly the string the auth flows
            already ship ("Something went wrong. Please try again.") — no new
            user-facing copy is introduced here. */}
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Please try again.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {reset ? (
            <Button onClick={() => reset()}>Try again</Button>
          ) : null}
          {/* A real <a>, not a router Link: the escape hatch must be a full
              page load so it also clears whatever client state threw. */}
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
        </div>
        {error?.digest ? (
          <p className="text-[11px] text-muted-foreground/60">
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
