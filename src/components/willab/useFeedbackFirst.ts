"use client";

import { useEffect, useRef, useState } from "react";
import { isConfidentVoiceFeedback } from "@/lib/willab/chunkSteps";
import {
  FEEDBACK_FIRST,
  feedbackFirstCard,
  machineReadOf,
  shownAtOpen,
} from "@/lib/willab/paragraphOverlay";
import { reportMomentEvent } from "@/services/api/momentEvents";
import type { DocumentSuggestion } from "@/services/api/idealText";

/** JUDGEMENT AFTER FEEDBACK (contract 24e-1; F1 Repair Plan Phase 6).
 *
 *  A waiting moment opens on the machine's feedback in the paragraph's own
 *  sheet; the judgement sheet is asked only when the speaker taps Next on a
 *  confident moment (or a card with nothing to practise). The open and a
 *  skip are told to the backend, which raises the coach request at the open
 *  and settles a skipped moment without an answer (0408, 24e-1).
 *
 *  `waiting`: the moment still waits for a judgement (the sheet would have
 *  opened on the question). Returns whether the question is being asked
 *  now, and the paragraph sheet's `awaiting` handlers, or null. */
export function useFeedbackFirst({
  waiting,
  items,
  text,
  onDone,
}: {
  waiting: boolean;
  items: readonly DocumentSuggestion[];
  text: string;
  onDone: () => void;
}): {
  asking: boolean;
  stopAsking: () => void;
  awaiting: { onJudge: () => void; onSkip: () => void } | null;
} {
  const [asking, setAsking] = useState(false);
  const on = FEEDBACK_FIRST && waiting;
  const snippetId = items.find(isConfidentVoiceFeedback)?.snippetId ?? null;
  const reported = useRef(false);
  useEffect(() => {
    if (!on || !snippetId || reported.current) return;
    reported.current = true;
    const card = feedbackFirstCard(items, machineReadOf(items), text);
    void reportMomentEvent(snippetId, "opened", shownAtOpen(card));
  }, [on, snippetId, items, text]);
  if (!on) return { asking: false, stopAsking: () => undefined, awaiting: null };
  return {
    asking,
    stopAsking: () => setAsking(false),
    awaiting: asking
      ? null
      : {
          onJudge: () => setAsking(true),
          onSkip: () => {
            if (snippetId) void reportMomentEvent(snippetId, "skipped");
            onDone();
          },
        },
  };
}
