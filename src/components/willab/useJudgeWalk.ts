"use client";

import { useCallback, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  useJudgeWalk — the coach's way through one arc: judgement first.           */
/*                                                                            */
/*  Opening a student used to land on the Feedbacks review, so the coach met   */
/*  the machine's guesses before giving their own read, and reached the blind  */
/*  pass only by tapping a take row and dismissing the panel on top of it.     */
/*  The walk goes take by take instead, and only when every take is judged     */
/*  does the star lane open.                                                   */
/*                                                                            */
/*  It lives OUTSIDE the Lounge on purpose. The hub is one of the functions    */
/*  the complexity ratchet has grandfathered, so a branch added there has to   */
/*  be paid for by taking one out — and this is self-contained state with no   */
/*  claim on the rest of the hub.                                              */
/*                                                                            */
/*  It holds no lane vocabulary: the caller says what to open, so the review   */
/*  lane and the star lane still import nothing from each other (N1).          */
/* -------------------------------------------------------------------------- */

export interface JudgeWalk {
  arcId: string;
  sessionIds: string[];
  at: number;
}

export function useJudgeWalk(handlers: {
  /** Open one take's judgement queue. */
  onOpenTake: (sessionId: string) => void;
  /** Every take judged — open the arc's Feedbacks review. */
  onComplete: (arcId: string, sessionIds: string[]) => void;
}) {
  const { onOpenTake, onComplete } = handlers;
  const [walk, setWalk] = useState<JudgeWalk | null>(null);

  const start = useCallback(
    (arcId: string, sessionIds: string[]) => {
      if (sessionIds.length === 0) return;
      setWalk({ arcId, sessionIds, at: 0 });
      onOpenTake(sessionIds[0]);
    },
    [onOpenTake],
  );

  /** This take's queue is fully answered: the next take, or the feedback. */
  const advance = useCallback(() => {
    setWalk((current) => {
      if (!current) return null;
      const next = current.at + 1;
      if (next < current.sessionIds.length) {
        onOpenTake(current.sessionIds[next]);
        return { ...current, at: next };
      }
      onComplete(current.arcId, current.sessionIds);
      return null;
    });
  }, [onOpenTake, onComplete]);

  const stop = useCallback(() => setWalk(null), []);

  /** What the queue's last action says. Absent when no walk is running — the
   *  queue then simply closes, as a single deep-linked review should. */
  const completeLabel = walk
    ? walk.at + 1 < walk.sessionIds.length
      ? `Judge take ${walk.at + 2}`
      : "On to the feedback"
    : undefined;

  return {
    walk,
    start,
    stop,
    completeLabel,
    /** Undefined when no walk is running, so the queue's last action simply
     *  closes — which is what a single deep-linked review should do. */
    onQueueComplete: walk ? advance : undefined,
  };
}
