"use client";

import { useEffect, useState, type ReactNode } from "react";
import ParagraphSheet from "@/components/willab/ParagraphSheet";
import type {
  ChunkHistoryLite,
  ChunkState,
  CoachMomentLite,
} from "@/lib/willab/deckChunks";
import { opensParagraphSheet } from "@/lib/willab/answeredBookmark";
import type { RootGateAnswer } from "@/lib/willab/chunkSteps";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { Pager } from "@/components/willab/feedbackPager";
import { useBoundedWait } from "@/components/willab/paragraphSheetData";

export type PractiseAgain = {
  item: DocumentSuggestion;
  answer: RootGateAnswer;
} | null;

const FIVE = new Set(["yes", "in_between", "no", "not_sure", "audio_unclear"]);

/** The owner's stored answer as the sheet's judgement: one of the five, or
 *  null when it is not one of them (the ladder then asks again). */
export function asJudgement(answer: string | null): RootGateAnswer {
  return answer && FIVE.has(answer) ? (answer as RootGateAnswer) : null;
}

/** Which sheet a tapped paragraph opens (founder 2026-09-25, Q19 A / Q26 B):
 *  a paragraph with nothing waiting that was answered or locked opens its
 *  own sheet; everything else — and Practise from that sheet — opens the
 *  judgement sheet, rendered by the host. */
export default function OpenChunkSheet({
  state,
  arcId,
  takeSessionId,
  headline,
  onUseHelperWords,
  pager = null,
  slideLabel = null,
  onDocumentChanged = null,
  feedbackPending = false,
  onClose,
  renderSheet,
}: {
  state: ChunkState<DocumentSuggestion, ChunkHistoryLite, CoachMomentLite>;
  arcId: string | null;
  takeSessionId: string | null;
  /** The Slide's locked helper words, joined " · ", or null. */
  headline: string | null;
  onUseHelperWords?: ((span: RootPhraseSpan) => Promise<boolean>) | null;
  pager?: Pager | null;
  /** Where the paragraph sits ("Slide 2"), for the Take stack's header. */
  slideLabel?: string | null;
  /** Re-read the document (a stale exercise offer, MLC-3 §3.5). */
  onDocumentChanged?: (() => void) | null;
  /** The Take's feedback is still arriving after the text. */
  feedbackPending?: boolean;
  onClose: () => void;
  renderSheet: (practiseAgain: PractiseAgain) => ReactNode;
}) {
  const [practiseAgain, setPractiseAgain] = useState<PractiseAgain>(null);
  // HELD WHILE THE FEEDBACK ARRIVES (founder 2026-09-28): tapped before the
  // Take's feedback lands, a sheet used to open without the moment's
  // recording, answer and exercise, which then appeared a moment later. It
  // now waits for them (at most OPEN_WAIT_MS) and opens complete. The wait
  // also decides WHICH sheet correctly: an unanswered moment that is still
  // on its way must open the judgement sheet, not the paragraph's own.
  const held = useBoundedWait(feedbackPending);
  // Decided ONCE, when the sheet opens. Answering inside the judgement sheet
  // empties the paragraph's pending list; reading it live would swap the
  // sheet for the history halfway down the ladder.
  const [ownSheet, setOwnSheet] = useState<boolean | null>(() =>
    held ? null : opensParagraphSheet(state));
  useEffect(() => {
    if (!held && ownSheet === null) setOwnSheet(opensParagraphSheet(state));
  }, [held, ownSheet, state]);
  if (ownSheet === null) return null;
  if (practiseAgain || !ownSheet) {
    return <>{renderSheet(practiseAgain)}</>;
  }
  return (
    <ParagraphSheet
      arcId={arcId}
      takeSessionId={takeSessionId}
      partId={state.chunk.part.id}
      text={state.chunk.part.text}
      headline={headline}
      locked={state.locked}
      decided={state.decided}
      onPractise={(item, answer) =>
        setPractiseAgain({ item, answer: asJudgement(answer) })
      }
      onUseHelperWords={onUseHelperWords}
      pager={pager}
      slideLabel={slideLabel}
      onDocumentChanged={onDocumentChanged}
      onClose={onClose}
    />
  );
}
