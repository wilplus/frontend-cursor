"use client";

/* -------------------------------------------------------------------------- */
/*  The walk over one take (founder 2026-09-30, A7; build plan P2-9, P2-10).   */
/*                                                                            */
/*  One cursor over the take's bookmarked moments, in the queue's order. A     */
/*  moment not yet rated by this coach shows Judge; a rated one shows Read.    */
/*  After a rating the same moment moves to Read on its own; after Nothing to  */
/*  add the next open moment opens on its own with a small toast; when none is */
/*  left the walk closes back to the queue. The ‹ › bar walks the moments in   */
/*  either direction.                                                          */
/*                                                                            */
/*  Group 3 bridge: Answer hands the request to the host, which opens today's  */
/*  answer path for that take; screens 4 to 6 replace it in group 4.          */
/* -------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import CoachJudgeSheet, { type JudgeClip } from "./CoachJudgeSheet";
import CoachReadSheet from "./CoachReadSheet";
import { fetchCoachReviewSession } from "@/services/api/coachReview";
import type { CoachExerciseRequest } from "@/services/api/coachExerciseRequest";
import {
  afterJudged, afterNothingToAdd, nextOpenIndex, replaceMoment,
  type AnswerValue, type QueueMoment, type QueueSpeaker, type QueueTake,
} from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";
import type { Pager } from "../feedbackPager";

function Toast({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
    >
      <span className="rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-lg">
        {text}
      </span>
    </div>
  );
}

export default function CoachWalkOverlay({
  speaker,
  take,
  startSnippetId,
  onClose,
  onAnswer,
  onChanged,
}: {
  speaker: QueueSpeaker;
  take: QueueTake;
  startSnippetId: string;
  onClose: () => void;
  /** The host opens the answer for this take's moment (group 3 bridge). */
  onAnswer: (sessionId: string, snippetId: string, request: CoachExerciseRequest) => void;
  /** Something was saved: the host may refresh the queue. */
  onChanged: () => void;
}) {
  const [moments, setMoments] = useState<QueueMoment[]>(take.moments);
  const [cursor, setCursor] = useState(() =>
    Math.max(0, take.moments.findIndex((m) => m.snippetId === startSnippetId)),
  );
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [clips, setClips] = useState<Record<string, JudgeClip>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachReviewSession(take.sessionId).then((session) => {
      if (cancelled || !session) return;
      const next: Record<string, JudgeClip> = {};
      for (const s of session.snippets) {
        next[s.id] = { src: s.audioRef, startOffsetMs: s.startOffsetMs, durationMs: s.durationMs };
      }
      setClips(next);
    });
    return () => { cancelled = true; };
  }, [take.sessionId]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const moment = moments[cursor];
  const pager: Pager = useMemo(() => ({
    index: cursor,
    total: moments.length,
    label: speaker.pseudonym,
    onBack: () => setCursor((c) => Math.max(0, c - 1)),
    onNext: () => setCursor((c) => Math.min(moments.length - 1, c + 1)),
  }), [cursor, moments.length, speaker.pseudonym]);

  if (!moment) return null;

  function judged(value: AnswerValue): void {
    if (!moment) return;
    setAnswers((prev) => ({ ...prev, [moment.snippetId]: value }));
    setMoments((prev) => replaceMoment(prev, afterJudged(moment)));
    setToast(COPY.toastJudged);
    onChanged();
  }

  function advance(): void {
    const next = nextOpenIndex(moments, cursor);
    if (next === -1) onClose();
    else setCursor(next);
  }

  function nothingToAdd(): void {
    if (!moment) return;
    const updated = replaceMoment(moments, afterNothingToAdd(moment));
    setMoments(updated);
    setToast(COPY.toastNothingToAdd);
    onChanged();
    const next = nextOpenIndex(updated, cursor);
    if (next === -1) onClose();
    else setCursor(next);
  }

  const needsJudging = moment.state === "judge_it" && !answers[moment.snippetId];

  return (
    <>
      {needsJudging ? (
        <CoachJudgeSheet
          key={`judge:${moment.snippetId}`}
          snippetId={moment.snippetId}
          pager={pager}
          clip={clips[moment.snippetId] ?? null}
          onClose={onClose}
          onJudged={judged}
        />
      ) : (
        <CoachReadSheet
          key={`read:${moment.snippetId}`}
          sessionId={take.sessionId}
          snippetId={moment.snippetId}
          pseudonym={speaker.pseudonym}
          pager={pager}
          coachAnswer={answers[moment.snippetId] ?? null}
          onClose={onClose}
          onAnswer={(request) => onAnswer(take.sessionId, moment.snippetId, request)}
          onNothingToAdd={nothingToAdd}
          onNext={advance}
        />
      )}
      {toast ? <Toast text={toast} /> : null}
    </>
  );
}
