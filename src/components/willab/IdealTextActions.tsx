"use client";

import { useEffect, useRef } from "react";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import { WalkLink, WalkPill } from "./walk/WalkFooter";
import { useLoungeThreadMaybe } from "./LoungeThreadContext";
import {
  keepNextTakeShare,
  readSend,
  SEND_READ_CAP_MS,
  shareChoiceMeta,
  within,
  type PeopleShareMeta,
  type SendRead,
} from "@/lib/willab/nextTakeShare";
import { shareLineDraft } from "@/lib/willab/walkThread";
import { WALK_COPY } from "./idealEditCopy";

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
  arcId = null,
  endCard = false,
  onClose = null,
  shareFirst = false,
  confirmFirst = null,
}: {
  /** The project, for the sharing question's chat bubbles. */
  arcId?: string | null;
  /** The BE's gate on recording a new OFFICIAL take. Gates ONLY on an
   *  explicit false; null / absent leaves the button available. */
  canRecordTake?: boolean | null;
  /** Route into the regular record flow for the next official take. */
  onNewTake: () => void;
  takeCount?: number | null;
  /** A moment of this Take still waits for the speaker's judgement, or the
   *  coach left a word on this Take that Step 0 has not shown yet (founder
   *  2026-10-05; backend N77). */
  reviewWaiting?: boolean;
  /** Walk the waiting moments, from the first one in text order. */
  onReview?: () => void;
  /** After the walk (Q-B10 A): reopen the finished walk from the link under
   *  "Record Take N". Null until the page can tell a finished walk apart. */
  onReviewAgain?: (() => void) | null;
  /** The walk's end card (J4): the next Take only. */
  endCard?: boolean;
  /** The grey "Close" under "Record Take N", the page's one way out to the
   *  chat (founder lock 2026-10-12, sections 4 and 9). */
  onClose?: (() => void) | null;
  /** Opened from "Record Take N" in the Lounge: the next Take starts at
   *  once, and its ✕ goes back to the chat. */
  shareFirst?: boolean;
  /** An archived project asks "One project at a time" before its next
   *  Take (founder 2026-10-29, backend N254); `go` runs on Continue. null =
   *  the current project, which never asks (Never 3). */
  confirmFirst?: ((go: () => void) => void) | null;
}) {
  /* JOURNEY DECISIONS J1 AND J4 (founder 2026-09-29; F1 Repair Plan Phase 7).
   * J1: after a Take the speaker lands on the text and taps "Review
   * feedback", with the next Take one tap away underneath. J4: the walk's end
   * card offers the next Take as its one button ("Back to the text" is its
   * link, drawn by the card). */
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
  /* From Take 2 on, the Take goes to nobody unless the speaker sends it
     (founder 2026-11-10, backend N626): nothing is asked before it and no
     earlier choice is reused; its line reads "Only me" and opens "Who
     hears this Take" for it afterwards. Was: asked once, then the
     remembered choice sent every Take (N309 item 5, N470, N479 item 5). */
  const asksShare = typeof takeCount === "number" && takeCount >= 1;
  const next = useRecordAlone(asksShare, arcId, onNewTake);
  const start = asksShare ? next : onNewTake;
  useEffect(() => {
    if (shareFirst && asksShare) next();
    // Once, as the page opens from the chat's "Record Take N".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const record = {
    label: nextRecordingLabel,
    onClick: confirmFirst ? () => confirmFirst(start) : start,
    disabled: canRecordTake === false,
  };

  return (
    <div data-ideal-text-actions className="flex flex-col gap-1">
      {/* "Record Take N" and the grey "Close" (founder lock 2026-10-12,
          sections 4 and 9): no ✕ at the top, no "Review feedback" here; a
          moment's sentence opens its step, and the Lounge reopens the walk. */}
      <WalkPill action={record} dot />
      {!endCard && onClose ? <WalkLink action={{ label: "Close", onClick: onClose }} /> : null}
      {canRecordTake === false ? (
        <p className="text-center text-[12px] text-muted-foreground">
          {IDEAL_EDIT_COPY.recordUnavailable}
        </p>
      ) : null}
    </div>
  );
}

/** The line a new Take starts with: "Only me", in the shape its screen
 *  reads back (people with the sending switch on, N470; else the
 *  communities). null with the switch on and nobody in the list: there is
 *  nobody to send it to (R3). */
function aloneLine(send: SendRead): PeopleShareMeta | ReturnType<typeof shareChoiceMeta> | null {
  if (!send.enabled) return shareChoiceMeta(["none"], []);
  return send.people.length ? { kind: "people", all: false, user_ids: [], names: [] } : null;
}

/** "Record Take N" from Take 2 on (backend N626): the recording starts with
 *  nothing kept for its upload, so nothing is sent or shared, and the line
 *  "Only me" goes under its recording. One tap at a time; the switch and
 *  the list are read as the page opens, waited for 1.5 s at most (R1). */
function useRecordAlone(asksShare: boolean, arcId: string | null, record: () => void): () => void {
  const thread = useLoungeThreadMaybe();
  const read = useRef<Promise<SendRead> | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (asksShare && !read.current) read.current = readSend();
  }, [asksShare]);
  return () => {
    if (busy.current) return;
    busy.current = true;
    const pending = read.current ?? readSend();
    read.current = null;
    void within(pending, SEND_READ_CAP_MS, { enabled: false } as SendRead).then((send) => {
      busy.current = false;
      // A choice kept from before this rule is dropped, never applied.
      keepNextTakeShare(null);
      const share = aloneLine(send);
      if (share) void thread?.append(shareLineDraft(WALK_COPY.shareOnlyMe, share, arcId)).catch(() => undefined);
      record();
    });
  };
}
