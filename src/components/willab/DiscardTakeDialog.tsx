"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

/** The confirmation for throwing a take away — one dialog, two lanes.
 *
 *  `recording` is the original: the mic is live and closing the overlay would
 *  lose what is being spoken. `upload` is the second lane (founder 2026-09-16):
 *  the take has stopped and is going up, and aborting the request is the only
 *  window in which it leaves no server trace.
 *
 *  THE ONLY COPY THAT DIFFERS is the cancel label, and it differs because it
 *  has to. "Keep recording" is true while the mic is running and false the
 *  moment it stops — telling someone they can keep doing a thing they are no
 *  longer doing is the same class of untruth as a waiting screen naming work
 *  that is not running. The title, the body and the confirm label are shared,
 *  because they are true on both lanes: nothing has been saved either way.
 *
 *  ITS OWN FILE because LabOverlay sits on the complexity ratchet's
 *  grandfather line and may only come down. Adding the second lane inline
 *  pushed it 26 → 28 and the gate refused; a dialog is a component, so
 *  extracting is the fix the ratchet is asking for rather than a dodge.
 */
export default function DiscardTakeDialog({
  lane,
  onKeep,
  onDiscard,
}: {
  lane: "recording" | "upload";
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);

  /* THE DIALOG TAKES THE KEYBOARD, as ProcessingResumeOverlay does: focus
     moves in, on the safe answer (keep the Take). It is NOT handed back to
     the ✕ that opened it: on the recording screen Space turns the slide
     unless a button has focus (recordingGesture.ts, N70.1), so a ✕ holding
     focus would turn the next Space into "Discard this take?" again. Closed,
     focus leaves with the dialog, as it always did. */
  useEffect(() => {
    keepRef.current?.focus({ preventScroll: true });
  }, []);

  // Escape is the safe answer: the Take is kept. Tab goes round the two
  // answers and never behind the dialog.
  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onKeep();
      return;
    }
    if (event.key !== "Tab") return;
    const answers = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (answers.length === 0) return;
    event.preventDefault();
    const at = answers.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    answers[(at + step + answers.length) % answers.length].focus();
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-4 focus:outline-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-take-title"
      onKeyDown={keepFocusInside}
    >
      <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl">
        <h2
          id="discard-take-title"
          className="text-[18px] font-semibold text-foreground"
        >
          Discard this take?
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          This recording has not been saved.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            ref={keepRef}
            type="button"
            variant="outline"
            onClick={onKeep}
            className="rounded-full"
          >
            {lane === "recording" ? "Keep recording" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={onDiscard}
            className="rounded-full bg-record text-record-foreground hover:bg-record/90"
          >
            Discard take
          </Button>
        </div>
      </div>
    </div>
  );
}
