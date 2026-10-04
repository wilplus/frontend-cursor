"use client";

import { useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import { postJourneyNextSteps } from "@/services/api/journeyNextSteps";

/* -------------------------------------------------------------------------- */
/*  IdealTextActions — the master document's controls.                        */
/*                                                                            */
/*  ONE NEXT STEP (founder 2026-09-26, Ideal Text redesign B). "Save the      */
/*  ideal text" moved into the header's ⋯ (IdealTextMenu). The bottom holds   */
/*  the loop's next move: "Review feedback" while a moment waits, with the    */
/*  next take still one tap away underneath (the loop never waits on          */
/*  feedback), and the next take itself once nothing waits. The guided        */
/*  "See next steps" hand-off below is unchanged.                             */
/*                                                                            */
/*  TWO buttons since founder 2026-08-05, down from three:                    */
/*                                                                            */
/*    1. Save the ideal text — accept-and-freeze. Resolves the pending state  */
/*       server-side, so afterwards the take badges go and the clean script   */
/*       shows.                                                               */
/*    2. Record the next official take — the full pipeline.                   */
/*                                                                            */
/*  REMOVED: "Record a re-read" sat between them, gated on the save. Reading  */
/*  the settled text back into the mic produced nothing the coach or the user */
/*  could act on, so the lane is gone end to end (BE rejects it 422). What is */
/*  left is the loop that actually improves the text: take after take.        */
/*                                                                            */
/*  Losing the re-read also removed this component's whole busy-state problem.*/
/*  The next-take button used to be WITHHELD while a reading was live or      */
/*  still analysing, because it sat directly under a hot mic and tapping it   */
/*  there orphaned the reading's stream. With one lane there is no second     */
/*  recorder to collide with.                                                 */
/* -------------------------------------------------------------------------- */

export default function IdealTextActions({
  arcId,
  canRecordTake = null,
  onNewTake,
  takeCount = null,
  journeyNextStepsSeen = null,
  onSeeNextSteps,
  onSeeNextStepsAsGuest,
  reviewWaiting = false,
  onReview,
  endCard = false,
}: {
  arcId: string;
  /** The BE's gate on recording a new OFFICIAL take. Gates ONLY on an
   *  explicit false; null / absent leaves the button available. */
  canRecordTake?: boolean | null;
  /** Route into the regular record flow for the next official take. */
  onNewTake: () => void;
  takeCount?: number | null;
  journeyNextStepsSeen?: boolean | null;
  onSeeNextSteps?: () => void;
  /** A guest (Phase 0.6, founder 2026-10-04): "clicking see the next steps
   *  should open the sign up page and then should continue seamlessly as if
   *  I clicked it as a logged in person". Saving the step needs an account,
   *  so the guest goes to sign-up and the step is taken after it. */
  onSeeNextStepsAsGuest?: () => void;
  /** A moment of this Take still waits for the speaker's judgement. */
  reviewWaiting?: boolean;
  /** Walk the waiting moments, from the first one in text order. */
  onReview?: () => void;
  /** The walk's end card (J4): the next Take only. */
  endCard?: boolean;
}) {
  const [openingJourney, setOpeningJourney] = useState(false);

  const guidedTake =
    typeof takeCount === "number" && takeCount >= 1 && takeCount <= 3;
  const showNextSteps = !endCard && guidedTake && journeyNextStepsSeen === false;
  /* JOURNEY DECISIONS J1 AND J4 (founder 2026-09-29; F1 Repair Plan Phase 7).
   * J1: after a Take the speaker lands on the text and taps "Review
   * feedback" -- so it is never hidden behind "See next steps", and neither
   * is the next Take. "See next steps" stays reachable as the quiet link
   * underneath on the guided Takes. J4: the walk's end card offers the next
   * Take as its one button ("Back to the text" is its link). Nothing waits
   * on the journey answer any more, so nothing is blanked while it loads. */
  const review = !endCard && reviewWaiting && Boolean(onReview);
  const nextRecordingLabel =
    takeCount === 1
      ? "Record Take 2"
      : takeCount === 2
        ? "Record Take 3"
        : typeof takeCount === "number" && takeCount >= 3
          ? "Record again"
          : "Record the next take";

  const seeNextSteps = async () => {
    if (onSeeNextStepsAsGuest) return onSeeNextStepsAsGuest();
    if (openingJourney) return;
    setOpeningJourney(true);
    const ok = await postJourneyNextSteps(arcId);
    setOpeningJourney(false);
    if (ok) onSeeNextSteps?.();
  };

  return (
    <div className="mt-1 flex flex-col items-stretch gap-2 border-t border-border pt-4">
      {review ? (
        <Button
          type="button"
          onClick={onReview}
          className="h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          Review feedback
        </Button>
      ) : null}
      {/* The next Take: never removed, because the loop must not wait on
          feedback; a quiet link while a moment waits, the main button
          otherwise. Disabled rather than removed when the BE closes its
          gate, so the entry to the record loop never silently disappears. */}
      <Button
        type="button"
        onClick={onNewTake}
        disabled={canRecordTake === false}
        variant={review ? "ghost" : "default"}
        className={
          review
            ? "h-9 w-full rounded-full text-[14px] font-normal text-muted-foreground"
            : "h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        }
      >
        <Mic className="mr-2 h-4 w-4" aria-hidden />
        {nextRecordingLabel}
      </Button>
      {showNextSteps ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => void seeNextSteps()}
          disabled={openingJourney}
          className="h-9 w-full rounded-full text-[14px] font-normal text-muted-foreground"
        >
          {openingJourney ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          See next steps
        </Button>
      ) : null}
      {canRecordTake === false ? (
        <p className="text-center text-[12px] text-muted-foreground">
          {IDEAL_EDIT_COPY.recordUnavailable}
        </p>
      ) : null}
    </div>
  );
}
