"use client";

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-take-title"
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
