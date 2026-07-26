"use client";

import { useEffect, useState } from "react";
import { pickWaitingTip } from "./waitingTips";

/* -------------------------------------------------------------------------- */
/*  LoadingState — the ONE waiting indicator across the app.                    */
/*                                                                            */
/*  The brand's breathing voice mark, the same composition as the Welcome      */
/*  screen but smaller, so every wait looks like this product rather than a     */
/*  generic spinner. Built from the existing `breath-ring` and                  */
/*  `welcome-voice-dot` classes, which already carry a prefers-reduced-motion   */
/*  override in globals.css — reduced-motion users get the static mark for      */
/*  free. To change the look everywhere, change it HERE only.                   */
/*                                                                            */
/*  A tip appears on the LONG waits (fullscreen, or opted in), never on the     */
/*  small in-content loaders: a paragraph of advice under a 140px inline        */
/*  loader is clutter, and those resolve faster than anyone can read.           */
/* -------------------------------------------------------------------------- */

/** The breathing voice mark, scaled for a waiting state. Exported so a
 *  screen with its own layout (the analysis wait) shows the same mark. */
export function VoiceMark({ size }: { size: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: size, width: size }}
      aria-hidden="true"
    >
      <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
      <span
        className="breath-ring absolute inset-[6px] rounded-full border border-foreground/15"
        style={{ animationDelay: "0.6s" }}
      />
      <span
        className="breath-ring absolute inset-[12px] rounded-full border border-primary/30"
        style={{ animationDelay: "1.2s" }}
      />
      <svg
        width={Math.round(size * 0.42)}
        height={Math.round(size * 0.42)}
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <circle
          className="welcome-voice-dot"
          cx="12"
          cy="28"
          r="4"
          fill="hsl(var(--foreground))"
        />
        <circle
          className="welcome-voice-dot"
          cx="28"
          cy="28"
          r="6"
          fill="hsl(var(--foreground))"
        />
        <circle
          className="welcome-voice-dot"
          cx="44"
          cy="28"
          r="4"
          fill="hsl(var(--foreground))"
        />
      </svg>
    </div>
  );
}

export default function LoadingState({
  fullscreen = false,
  withTip,
}: {
  /** Full-viewport overlay (the lazy-overlay fallback). Default: fill the
   *  parent (an overlay's own loading state). */
  fullscreen?: boolean;
  /** Show a waiting tip. Defaults ON for fullscreen waits, OFF inline. */
  withTip?: boolean;
}) {
  const showTip = withTip ?? fullscreen;
  // Drawn ONCE, after mount. Picking during render would make the server and
  // the client disagree about which tip was drawn (a hydration mismatch), and
  // re-picking on every render would swap the line out from under whoever is
  // reading it. One tip per waiting session is the whole point.
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => {
    if (showTip) setTip(pickWaitingTip());
  }, [showTip]);

  const body = (
    <div className="flex flex-col items-center gap-6 px-6 text-center">
      <VoiceMark size={fullscreen ? 96 : 64} />
      <span className="sr-only" role="status">
        Loading
      </span>
      {showTip && tip ? (
        <p className="max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
          {tip}
        </p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background">
        {body}
      </div>
    );
  }
  return (
    <div className="flex min-h-[140px] flex-1 items-center justify-center">
      {body}
    </div>
  );
}
