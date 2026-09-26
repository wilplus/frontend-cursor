"use client";

import { useEffect } from "react";
import { Mic } from "lucide-react";
import ProcessingWait from "./ProcessingWait";

/** The screen for a project whose document is not there YET.
 *
 *  THE LOOP NEVER WAITS FOR A COACH (founder 2026-09-16, and again
 *  2026-09-26: "why is my ideal text gated behind this? The coach delivers
 *  the feedback later on"). This screen used to say "Your coach is still
 *  shaping your ideal text. It lands here the moment it's approved." That was
 *  never true of the product it sat in: the Ideal Text is the machine's, it
 *  is free and immediate after every Take, and coach review is asynchronous
 *  feedback on top of it. The state it actually meant is "no document has
 *  been put together for this project yet" — a first Take still assembling,
 *  or a snapshot still being published — so it now shows the same waiting
 *  screen the post-take handover shows (signed-off copy, one definition),
 *  and asks again every few seconds until the document is there.
 *
 *  Recording stays one tap away: `onReadAloud` is the ready state's next-take
 *  route, so a take started here goes through the identical submission path.
 *
 *  ITS OWN FILE because the overlay sits at the complexity ratchet's ceiling:
 *  the polling lives here, not there.
 */
export default function IdealTextPendingCoach({
  onReadAloud,
  onRetry,
}: {
  onReadAloud?: (version: number | null) => void;
  /** Ask for the document again. Called every few seconds while mounted,
   *  for a bounded while — the host refetches in place. */
  onRetry?: () => void;
}) {
  useEffect(() => {
    if (!onRetry) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 60) {
        clearInterval(timer);
        return;
      }
      onRetry();
    }, 5000);
    return () => clearInterval(timer);
  }, [onRetry]);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <ProcessingWait
        phase="document"
        progress={{ stage: "document_assembly", percent: null }}
      />
      {onReadAloud ? (
        <button
          type="button"
          onClick={() => onReadAloud(null)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-6 text-[15px] font-medium text-foreground"
        >
          <Mic className="h-4 w-4" aria-hidden />
          Record the next take
        </button>
      ) : null}
    </div>
  );
}
