"use client";

/* -------------------------------------------------------------------------- */
/*  The Lounge's one card for a coach (coach panel lock 2026-10-06, flow step  */
/*  1; prototype lounge()): "N speakers waiting · Open your queue", outlined  */
/*  in orange with the "new" tag while speakers wait; "Nobody is waiting for  */
/*  you." when none does. A count of people to see, never of quality (AC-9). */
/* -------------------------------------------------------------------------- */

import { cn } from "@/lib/utils";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

export function CoachWalkBubble({ waiting, onOpen }: { waiting: number; onOpen: () => void }) {
  const marked = waiting > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="coach-walk-bubble"
      data-marked={marked ? "true" : undefined}
      className={cn(
        "walk-press relative mr-auto flex w-[82%] items-center gap-2.5 rounded-[18px] border border-border bg-background px-3 py-2.5 text-left",
        marked && "outline outline-2 outline-offset-[3px] outline-primary",
      )}
    >
      <span aria-hidden="true" className="aspect-video w-16 flex-none rounded-md bg-[linear-gradient(135deg,#dde3ee,#c7d0e0)]" />
      <span className="min-w-0">
        <b className="block text-[15px] font-semibold text-foreground">
          {marked ? COPY.bubbleWaiting(waiting) : COPY.queueEmpty}
        </b>
        <small className="block text-[12px] text-muted-foreground">{COPY.bubbleOpen}</small>
      </span>
      {marked ? (
        <span className="absolute -right-1.5 -top-3.5 rounded-full bg-primary px-[9px] py-px text-[11px] font-semibold leading-[1.5] text-primary-foreground">
          {COPY.newTag}
        </span>
      ) : null}
    </button>
  );
}

export default CoachWalkBubble;
