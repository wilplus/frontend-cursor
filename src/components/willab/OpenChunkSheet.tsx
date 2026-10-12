"use client";

import { useEffect, useState, type ReactNode } from "react";
import ParagraphSheet from "@/components/willab/ParagraphSheet";
import { ownWordsCard, type PractiseCard } from "@/lib/willab/paragraphOverlay";
import { paragraphPractise } from "@/components/willab/useDeckFeedbackWalk";
import type {
  ChunkHistoryLite,
  ChunkState,
  CoachMomentLite,
} from "@/lib/willab/deckChunks";
import { opensParagraphSheet } from "@/lib/willab/answeredBookmark";
import { usePractiseOffered } from "@/components/willab/usePractiseOffered";
import { useFeedbackFirst } from "@/components/willab/useFeedbackFirst";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { Pager } from "@/components/willab/feedbackPager";
import { useBoundedWait } from "@/components/willab/paragraphSheetData";
import { useReopenedJudgement } from "@/components/willab/useReopenedJudgement";
import type { ReopenedJudgement } from "@/lib/willab/changeJudgement";

/** Which sheet a tapped paragraph opens (founder lock 2026-09-30, B5, B8):
 *  a paragraph with no judgement waiting, or with its helper words saved,
 *  opens its own sheet; a waiting judgement opens the judgement sheet,
 *  rendered by the host — and the answer hands the paragraph back to its
 *  own sheet (the practise state), where Practise opens the Feedback walk's
 *  practise screens on the card shown (founder 2026-10-10, "the practise
 *  screens should be the same in all cases"). */
export default function OpenChunkSheet({
  state,
  arcId,
  takeSessionId,
  headline,
  onUseHelperWords,
  onAccept = null,
  onDone = null,
  onSkip = null,
  pager = null,
  slideLabel = null,
  onDocumentChanged = null,
  feedbackPending = false,
  onClose,
  renderSheet,
  onPractise = null,
  helperWordsHost = null,
  startPicking = false,
  firstTake = false,
  reopenJudgement = false,
}: {
  state: ChunkState<DocumentSuggestion, ChunkHistoryLite, CoachMomentLite>;
  arcId: string | null;
  takeSessionId: string | null;
  /** The paragraph's saved helper words, joined " · ", or null. */
  headline: string | null;
  onUseHelperWords?: ((span: RootPhraseSpan) => Promise<boolean>) | null;
  /** Accept a rewrite on the document (29b); the host's decision handler. */
  onAccept?: ((item: DocumentSuggestion) => Promise<boolean>) | null;
  /** The paragraph's own sheet finished on its own: the host moves on. */
  onDone?: (() => void) | null;
  /** A waiting moment was skipped unanswered (24e-1): move on, no toast.
   *  The skipped moment rides along so the page settles its bar at once. */
  onSkip?: ((skipped: DocumentSuggestion | null) => void) | null;
  pager?: Pager | null;
  /** Where the paragraph sits ("Slide 2"), for the sheet's header. */
  slideLabel?: string | null;
  /** Re-read the document (a stale exercise offer, MLC-3 §3.5). */
  onDocumentChanged?: (() => void) | null;
  /** The Take's feedback is still arriving after the text. */
  feedbackPending?: boolean;
  onClose: () => void;
  /** The judgement sheet. `onAnswered` is the hand-off: the answer just
   *  given, after which this component draws the paragraph's own sheet. */
  renderSheet: (
    onAnswered: (answer: ConfidenceRatingValue) => void,
    /** ‹ back to an answered moment: its judgement, the latest answer
     *  pressed (QA1 A, D-FW-9). Null on every other opening. */
    reopen?: ReopenedJudgement | null,
  ) => ReactNode;
  /** THE PRACTISE (founder 2026-10-10, "the practise screens should be the
   *  same in all cases"): the host opens the Feedback walk's practise on the
   *  card, for the paragraph's moment. False when it could not. A card with
   *  nothing to open a practice on (paragraphPractise) shows no Practise.
   *  Absent: no Practise. */
  onPractise?: ((partId: string, card: PractiseCard, moment: DocumentSuggestion | null) => boolean) | null;
  /** THE HELPER WORDS OVERLAY (founder lock 2026-09-30, B4): its two
   *  writes the sheet cannot make itself. */
  helperWordsHost?: {
    onUseFromTake: (phrase: string, takeIndex: number) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
  } | null;
  /** The page's headline was tapped: open on the helper words. */
  startPicking?: boolean;
  /** The project has exactly one Take (the picker's Take 1 note). */
  firstTake?: boolean;
  /** Opened by ‹ (QA1 A, D-FW-9): an answered Confident Voice moment
   *  reopens its judgement with the latest answer pressed. */
  reopenJudgement?: boolean;
}) {
  /** The answer given in the judgement sheet this opening, carried into the
   *  paragraph's own sheet before the server's read of it lands. */
  const [answered, setAnswered] = useState<ConfidenceRatingValue | null>(null);
  const saved = Boolean(headline);
  // HELD WHILE THE FEEDBACK ARRIVES (founder 2026-09-28): tapped before the
  // Take's feedback lands, a sheet used to open without the moment's
  // recording, answer and exercise, which then appeared a moment later. It
  // now waits for them (at most OPEN_WAIT_MS) and opens complete. The wait
  // also decides WHICH sheet correctly: an unanswered moment that is still
  // on its way must open the judgement sheet, not the paragraph's own.
  const held = useBoundedWait(feedbackPending);
  const practiseOffered = usePractiseOffered();
  // Decided ONCE, when the sheet opens. Answering inside the judgement sheet
  // empties the paragraph's pending list; reading it live would swap the
  // sheet for the history halfway down the ladder. The hand-off is the one
  // deliberate swap, made by the answer itself.
  const [ownSheet, setOwnSheet] = useState<boolean | null>(() =>
    held ? null : opensParagraphSheet(state, saved));
  useEffect(() => {
    if (!held && ownSheet === null) setOwnSheet(opensParagraphSheet(state, saved));
  }, [held, ownSheet, state, saved]);
  // 24e-1 (Phase 6): a waiting moment opens on its feedback, not the question.
  const first = useFeedbackFirst({
    waiting: ownSheet === false,
    items: [...state.decided, ...state.pending],
    text: state.chunk.part.text,
    onDone: onSkip ?? onDone ?? onClose,
  });
  // ‹ back to an answered moment reopens its judgement (QA1 A, D-FW-9).
  const reopened = useReopenedJudgement({
    asked: reopenJudgement,
    state,
    saved,
    takeSessionId,
    partId: state.chunk.part.id,
  });
  if (ownSheet === null || reopened.waiting) return null;
  if (reopened.reopen || (!ownSheet && !first.awaiting)) {
    return (
      <>
        {renderSheet((answer) => {
          setAnswered(answer);
          setOwnSheet(true);
          reopened.done();
          first.stopAsking();
        }, reopened.reopen)}
      </>
    );
  }
  const partId = state.chunk.part.id;
  const paragraphText = state.chunk.part.text;
  const practiseOf = (card: PractiseCard, moment: DocumentSuggestion | null) =>
    paragraphPractise({ card, moment, partId, paragraphText, slideLabel });
  return (
    <ParagraphSheet
      arcId={arcId}
      takeSessionId={takeSessionId}
      partId={state.chunk.part.id}
      text={state.chunk.part.text}
      headline={headline}
      decided={state.decided}
      pending={state.pending}
      answer={answered}
      onPractise={onPractise ? (moment, _answer, _mode, card) => {
        // "Keep my words" practises the speaker's own words (29b).
        const shown = card ?? ownWordsCard([...state.decided, ...state.pending], paragraphText);
        if (!onPractise(partId, shown, moment)) (onDone ?? onClose)();
      } : null}
      onAccept={onAccept}
      practisable={(card, moment) => practiseOf(card, moment) !== null}
      // No Practise when Personalised practice is off (Phase 4, wiring
      // only); the accept stays.
      practiseOff={!practiseOffered}
      awaiting={first.awaiting}
      onUseHelperWords={onUseHelperWords}
      helperWordsHost={helperWordsHost}
      startPicking={startPicking}
      onDone={onDone}
      pager={pager}
      slideLabel={slideLabel}
      onDocumentChanged={onDocumentChanged}
      firstTake={firstTake}
      onClose={onClose}
    />
  );
}
