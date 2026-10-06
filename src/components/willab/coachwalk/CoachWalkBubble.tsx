"use client";

/* -------------------------------------------------------------------------- */
/*  The Lounge's one bubble for a coach, "N speakers waiting · Open your       */
/*  queue" (founder 2026-09-30, A7). Today's door (CoachWalkEntry) and the     */
/*  redrawn panel's door (CoachPanelDoor) both draw it, so it lives on its    */
/*  own. A count of people to see, never of quality (AC-9).                   */
/* -------------------------------------------------------------------------- */

import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

export function CoachWalkBubble({ waiting, onOpen }: { waiting: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="coach-walk-bubble"
      aria-label={COPY.bubbleOpen}
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-muted px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/80"
    >
      <span className="text-[14px] font-semibold text-foreground">{COPY.bubbleWaiting(waiting)}</span>
      <span className="mt-1 block text-[12px] text-muted-foreground">{COPY.bubbleOpen}</span>
    </button>
  );
}

export default CoachWalkBubble;
