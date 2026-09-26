"use client";

import { useEffect, useState } from "react";
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
  reviewWaiting = false,
  onReview,
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
  /** A moment of this Take still waits for the speaker's judgement. */
  reviewWaiting?: boolean;
  /** Walk the waiting moments, from the first one in text order. */
  onReview?: () => void;
}) {
  const [openingJourney, setOpeningJourney] = useState(false);

  const guidedTake =
    typeof takeCount === "number" && takeCount >= 1 && takeCount <= 3;
  /* THE KEY MOMENT MUST NOT GUESS (founder 2026-09-18).
   *
   * REPORTED: "for a moment Record take 2 and then next steps" — and on a
   * take that had just finished, the wrong one stayed until the app was
   * closed and reopened.
   *
   * `journeyNextStepsSeen` is `boolean | null`, and null means NOT KNOWN YET.
   * The old test was `journeyNextStepsSeen === false`, which reads null and
   * true identically — so while the answer was still in flight the screen
   * confidently offered the record button, the one action that skips the
   * hand-off entirely. It is the hinge of record -> Take -> next Take, so
   * being wrong here for a second is worse than being blank for a second.
   *
   * Why the answer can be slow, and can never arrive: on a fresh open the
   * document comes from `fetchIdealTextForDisplay`, whose body carries
   * `journey_next_steps_seen` directly. Every later read uses
   * `fetchIdealTextCore`, which does NOT carry it — it arrives as the
   * asynchronous `journey` enrichment section, and `mergeIdealTextEnrichment`
   * drops every section whose `documentSnapshotId` does not equal the core's.
   * A take publishes a new snapshot, so that equality is exactly what a
   * just-finished take is most likely to miss. That is the cold-open/restart
   * asymmetry, and it is filed separately — this component's job is only to
   * stop asserting an answer it does not have.
   *
   * BOUNDED, so the screen can never be dead: if the answer is still missing
   * after the grace window the record button returns, because a guided take
   * with no action at all is worse than the pre-existing behaviour. */
  const journeyKnown = typeof journeyNextStepsSeen === "boolean";
  const [journeyGraceOver, setJourneyGraceOver] = useState(false);
  useEffect(() => {
    if (journeyKnown) return;
    setJourneyGraceOver(false);
    const timer = setTimeout(() => setJourneyGraceOver(true), 5000);
    return () => clearTimeout(timer);
  }, [journeyKnown, arcId, takeCount]);
  const showNextSteps = guidedTake && journeyNextStepsSeen === false;
  /** Neither button, rather than the wrong one, while the answer is in
   *  flight. Only ever true inside the guided 1–3 window. */
  const decidingNextSteps = guidedTake && !journeyKnown && !journeyGraceOver;
  const nextRecordingLabel =
    takeCount === 1
      ? "Record Take 2"
      : takeCount === 2
        ? "Record Take 3"
        : typeof takeCount === "number" && takeCount >= 3
          ? "Record again"
          : "Record the next take";

  const seeNextSteps = async () => {
    if (openingJourney) return;
    setOpeningJourney(true);
    const ok = await postJourneyNextSteps(arcId);
    setOpeningJourney(false);
    if (ok) onSeeNextSteps?.();
  };

  return (
    <div className="mt-1 flex flex-col items-stretch gap-2 border-t border-border pt-4">
      {showNextSteps ? (
        <Button
          type="button"
          onClick={() => void seeNextSteps()}
          disabled={openingJourney}
          className="h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          {openingJourney ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          See next steps
        </Button>
      ) : null}

      {/* The next move. While a moment waits: Review feedback, and the next
          take as a quiet link beneath it — never removed, because the loop
          must not wait on feedback. Once nothing waits: the next take is the
          main button. Disabled rather than removed when the BE closes its
          gate, so the entry to the record loop never silently disappears. */}
      {!showNextSteps && !decidingNextSteps && reviewWaiting && onReview ? (
        <Button
          type="button"
          onClick={onReview}
          className="h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          Review feedback
        </Button>
      ) : null}
      {!showNextSteps && !decidingNextSteps ? (
        <Button
          type="button"
          onClick={onNewTake}
          disabled={canRecordTake === false}
          variant={reviewWaiting && onReview ? "ghost" : "default"}
          className={
            reviewWaiting && onReview
              ? "h-9 w-full rounded-full text-[14px] font-normal text-muted-foreground"
              : "h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          }
        >
          <Mic className="mr-2 h-4 w-4" aria-hidden />
          {nextRecordingLabel}
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
