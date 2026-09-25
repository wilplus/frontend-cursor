"use client";

import { useState, type ReactNode } from "react";
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
  onClose,
  renderSheet,
}: {
  state: ChunkState<DocumentSuggestion, ChunkHistoryLite, CoachMomentLite>;
  arcId: string | null;
  takeSessionId: string | null;
  /** The Slide's locked helper words, joined " · ", or null. */
  headline: string | null;
  onUseHelperWords?: ((span: RootPhraseSpan) => Promise<boolean>) | null;
  onClose: () => void;
  renderSheet: (practiseAgain: PractiseAgain) => ReactNode;
}) {
  const [practiseAgain, setPractiseAgain] = useState<PractiseAgain>(null);
  // Decided ONCE, when the sheet opens. Answering inside the judgement sheet
  // empties the paragraph's pending list; reading it live would swap the
  // sheet for the history halfway down the ladder.
  const [ownSheet] = useState(() => opensParagraphSheet(state));
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
      onClose={onClose}
    />
  );
}
