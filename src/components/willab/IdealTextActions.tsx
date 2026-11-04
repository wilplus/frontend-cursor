"use client";

import { useEffect, useRef, useState } from "react";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import { WalkLink, WalkPill } from "./walk/WalkFooter";
import NextTakeShareScreen from "./NextTakeShareScreen";
import { useLoungeThreadMaybe } from "./LoungeThreadContext";
import {
  keepNextTakeShare,
  keptSendOf,
  readSend,
  rememberedChoice,
  SEND_READ_CAP_MS,
  sendDecision,
  ticksOf,
  within,
  type SendRead,
} from "@/lib/willab/nextTakeShare";
import { peopleLine, shareLineDraft, shareLineText } from "@/lib/willab/walkThread";

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
   *  once (the sharing screen first when it asks), and its ✕ goes back to
   *  the chat. */
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
  /* From Take 2 on, sharing is asked once, the first time "Record Take 2"
     is tapped; after that the remembered choice goes with the next Take at
     once, and the screen asks again only when the words change or a
     community is added (backend N309 item 5). */
  const asksShare = typeof takeCount === "number" && takeCount >= 1;
  // The screen opens with what was read, so it never reads twice (N470).
  const [asking, setAsking] = useState<false | { send?: SendRead }>(false);
  const next = useRememberedShare(asksShare, arcId, onNewTake, (send) => setAsking({ send }));
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
      {asking ? (
        <NextTakeShareScreen
          takeCount={takeCount}
          arcId={arcId}
          send={asking.send}
          onDone={() => {
            setAsking(false);
            onNewTake();
          }}
          onClose={shareFirst && onClose ? onClose : () => setAsking(false)}
        />
      ) : null}
    </div>
  );
}

/** What "Record Take N" found: with the backend's switch on (N470), the
 *  people and their last choice; else today's remembered community choice. */
type NextChoice =
  | { kind: "send"; send: Extract<SendRead, { enabled: true }> }
  | { kind: "community"; kept: Awaited<ReturnType<typeof rememberedChoice>> };

async function nextChoice(): Promise<NextChoice> {
  const send = await readSend();
  if (send.enabled) return { kind: "send", send };
  return { kind: "community", kept: await rememberedChoice() };
}

/** "Record Take N" from Take 2 on (backend N309 item 5): the remembered
 *  choice, read as the page opens, goes with the next Take, kept for its
 *  upload and stored as the line under its recording, and the recording
 *  starts at once; anything else asks (`ask`). One tap at a time. The tap
 *  waits for the read 1.5 s at most, then asks (R1). With the switch on
 *  (N470, N479) the choice is people: nobody in the list records with
 *  nothing sent (R3); a choice kept goes as the line and, after the
 *  upload, as the send. */
function useRememberedShare(
  asksShare: boolean,
  arcId: string | null,
  record: () => void,
  ask: (send?: SendRead) => void,
): () => void {
  const thread = useLoungeThreadMaybe();
  const read = useRef<Promise<NextChoice> | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (asksShare && !read.current) read.current = nextChoice();
  }, [asksShare]);
  return () => {
    if (busy.current) return;
    busy.current = true;
    const pending = read.current ?? nextChoice();
    // The next tap reads again: the choice may change in between.
    read.current = null;
    void within(pending, SEND_READ_CAP_MS, null).then((found) => {
      busy.current = false;
      if (!found) return ask();
      if (found.kind === "send") {
        const decision = sendDecision(found.send);
        if (decision.go === "ask") return ask(found.send);
        if (decision.go === "record") {
          keepNextTakeShare(null);
          return record();
        }
        keepNextTakeShare(keptSendOf(decision.share));
        void thread?.append(shareLineDraft(peopleLine(decision.share), decision.share, arcId)).catch(() => undefined);
        return record();
      }
      const kept = found.kept;
      if (!kept) return ask({ enabled: false });
      const { share, names } = kept;
      keepNextTakeShare(share.none ? null : { general: share.general, communityIds: share.community_ids });
      void thread?.append(shareLineDraft(shareLineText(ticksOf(share), names), share, arcId)).catch(() => undefined);
      record();
    });
  };
}
