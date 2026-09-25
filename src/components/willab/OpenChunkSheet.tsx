"use client";

import { useState, type ReactNode } from "react";
import AnsweredBookmarkSheet from "@/components/willab/AnsweredBookmarkSheet";
import type {
  ChunkHistoryLite,
  ChunkState,
  CoachMomentLite,
} from "@/lib/willab/deckChunks";
import { opensAnswered } from "@/lib/willab/answeredBookmark";
import type { RootGateAnswer } from "@/lib/willab/chunkSteps";
import type { DocumentSuggestion } from "@/services/api/idealText";

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

/** Which sheet a tapped paragraph opens (founder 2026-09-25, Q19 A): an
 *  answered bookmark opens its history; everything else — and Practise from
 *  that history — opens the judgement sheet, rendered by the host. */
export default function OpenChunkSheet({
  state,
  arcId,
  takeSessionId,
  onClose,
  renderSheet,
}: {
  state: ChunkState<DocumentSuggestion, ChunkHistoryLite, CoachMomentLite>;
  arcId: string | null;
  takeSessionId: string | null;
  onClose: () => void;
  renderSheet: (practiseAgain: PractiseAgain) => ReactNode;
}) {
  const [practiseAgain, setPractiseAgain] = useState<PractiseAgain>(null);
  if (practiseAgain || !opensAnswered(state)) {
    return <>{renderSheet(practiseAgain)}</>;
  }
  return (
    <AnsweredBookmarkSheet
      arcId={arcId}
      takeSessionId={takeSessionId}
      partId={state.chunk.part.id}
      decided={state.decided}
      onPractise={(item, answer) =>
        setPractiseAgain({ item, answer: asJudgement(answer) })
      }
      onClose={onClose}
    />
  );
}
