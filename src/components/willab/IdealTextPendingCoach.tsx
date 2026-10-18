"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import ProcessingWait from "./ProcessingWait";
import { idealTextWaitStart, pendingAskDelay } from "@/lib/willab/idealTextWait";

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
 *
 *  ONE CLOCK PER PROJECT (founder 2026-10-18: "make it finish even when you
 *  leave the page and come back ... not reloading the last 5-10% again and
 *  again"). The wait's start and its asking used to live in this component's
 *  memory, so every remount — a tab switch, a reopened overlay, a reload —
 *  restarted the bar's last slice and reset the bound on the asks. The clock
 *  is now `idealTextWait`'s, kept per project in storage: a return carries
 *  on from where the bar was, the asks are paced from the wait's real age
 *  (five seconds, then fifteen, then none), and they pause while the tab is
 *  hidden and fire the moment it is seen again.
 */
export default function IdealTextPendingCoach({
  arcId = null,
  onReadAloud,
  onRetry,
}: {
  /** The project waited for. With it the wait keeps one clock across
   *  remounts; without it the clock is this mount's. */
  arcId?: string | null;
  onReadAloud?: (version: number | null) => void;
  /** Ask for the document again. Called on a cadence while mounted and the
   *  tab is visible, for a bounded while — the host refetches in place. */
  onRetry?: () => void;
}) {
  // Read once per mount: the clock already running for this project, or one
  // started now. A later mount of the same project reads the same start.
  const [startedAt] = useState(() =>
    arcId ? idealTextWaitStart(arcId) : Date.now(),
  );

  useEffect(() => {
    if (!onRetry) return;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const schedule = () => {
      stop();
      if (document.visibilityState === "hidden") return;
      const delay = pendingAskDelay(Date.now() - startedAt);
      if (delay === null) return;
      timer = window.setTimeout(() => {
        onRetry();
        schedule();
      }, delay);
    };
    // Coming back to the tab: one ask at once, then the cadence again. Going
    // away: nothing until then — no one is there to see the answer.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        stop();
        return;
      }
      if (pendingAskDelay(Date.now() - startedAt) !== null) onRetry();
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onRetry, startedAt]);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <ProcessingWait
        phase="document"
        progress={{ stage: "document_assembly", percent: null }}
        phaseStartedAt={startedAt}
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
