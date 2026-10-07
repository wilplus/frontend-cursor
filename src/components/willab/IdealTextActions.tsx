"use client";

import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import { WalkLink, WalkPill } from "./walk/WalkFooter";

/* -------------------------------------------------------------------------- */
/*  IdealTextActions — the bottom of the text page.                           */
/*                                                                            */
/*  ONE NEXT STEP (founder 2026-09-26, Ideal Text redesign B). "Save the      */
/*  ideal text" moved into the header's ⋯ (IdealTextMenu). The bottom holds   */
/*  the loop's next move: "Review feedback" while a moment waits, with the   */
/*  next take still one tap away underneath (the loop never waits on         */
/*  feedback), and the next take itself once nothing waits.                   */
/*                                                                            */
/*  DRAWN AS THE WALK PROTOTYPE'S .foot (founder lock 2026-10-06; founder     */
/*  2026-10-07, Q-B10 A; build plan D-IT-8): the walk's own pill and link,    */
/*  54px / 16px semibold and 40px / 16px muted, with no top border. The      */
/*  Record pill carries the 10px red dot, not a mic. After the walk the      */
/*  bottom is "● Record Take N" with a "Review feedback" link that reopens   */
/*  the walk (`onReviewAgain`); the page passes it only where it has the     */
/*  data. "See next steps" is gone (Q-B10 A), and with it the journey hand- */
/*  off this component used to make.                                         */
/*                                                                            */
/*  TWO buttons since founder 2026-08-05, down from three: the re-read lane  */
/*  is retired end to end (BE rejects it 422). What is left is the loop that */
/*  actually improves the text: take after take.                             */
/* -------------------------------------------------------------------------- */

export default function IdealTextActions({
  canRecordTake = null,
  onNewTake,
  takeCount = null,
  reviewWaiting = false,
  onReview,
  onReviewAgain = null,
  endCard = false,
}: {
  /** The BE's gate on recording a new OFFICIAL take. Gates ONLY on an
   *  explicit false; null / absent leaves the button available. */
  canRecordTake?: boolean | null;
  /** Route into the regular record flow for the next official take. */
  onNewTake: () => void;
  takeCount?: number | null;
  /** A moment of this Take still waits for the speaker's judgement, or the
   *  coach left a word on this Take that Step 0 has not shown yet (founder
   *  2026-10-05, N48.3 Q11 A). */
  reviewWaiting?: boolean;
  /** Walk the waiting moments, from the first one in text order. */
  onReview?: () => void;
  /** After the walk (Q-B10 A): reopen the finished walk from the link under
   *  "Record Take N". Null until the page can tell a finished walk apart. */
  onReviewAgain?: (() => void) | null;
  /** The walk's end card (J4): the next Take only. */
  endCard?: boolean;
}) {
  /* JOURNEY DECISIONS J1 AND J4 (founder 2026-09-29; F1 Repair Plan Phase 7).
   * J1: after a Take the speaker lands on the text and taps "Review
   * feedback", with the next Take one tap away underneath. J4: the walk's end
   * card offers the next Take as its one button ("Back to the text" is its
   * link, drawn by the card). */
  const review = !endCard && reviewWaiting && Boolean(onReview);
  /* "Record Take N" on every Take, N the next one (founder 2026-10-05,
   * N48.3 Q8 A, replacing "Record again" from Take 3 on; lock D8). */
  const nextRecordingLabel =
    typeof takeCount === "number" && Number.isInteger(takeCount) && takeCount >= 1
      ? `Record Take ${takeCount + 1}`
      : "Record the next take";
  /* The next Take: never removed, because the loop must not wait on
     feedback; the quiet link while a moment waits, the main pill otherwise.
     Disabled rather than removed when the BE closes its gate, so the entry
     to the record loop never silently disappears. */
  const record = { label: nextRecordingLabel, onClick: onNewTake, disabled: canRecordTake === false };

  return (
    <div data-ideal-text-actions className="flex flex-col gap-1">
      {review ? (
        <>
          <WalkPill action={{ label: "Review feedback", onClick: onReview as () => void }} />
          <WalkLink action={record} />
        </>
      ) : (
        <>
          <WalkPill action={record} dot />
          {!endCard && onReviewAgain ? (
            <WalkLink action={{ label: "Review feedback", onClick: onReviewAgain }} />
          ) : null}
        </>
      )}
      {canRecordTake === false ? (
        <p className="text-center text-[12px] text-muted-foreground">
          {IDEAL_EDIT_COPY.recordUnavailable}
        </p>
      ) : null}
    </div>
  );
}
