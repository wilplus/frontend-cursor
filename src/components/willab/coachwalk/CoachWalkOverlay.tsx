"use client";

/* -------------------------------------------------------------------------- */
/*  The walk over one take (founder 2026-09-30, A7; build plan P2-9 to P2-12). */
/*                                                                            */
/*  One cursor over the take's bookmarked moments, in the queue's order. A     */
/*  moment not yet rated by this coach shows Judge; a rated one shows Read;   */
/*  Answer opens Words, Video, Home on the same moment. After an answer or    */
/*  Nothing to add the next open moment opens on its own with a small toast;  */
/*  after the last, "A word for this Take" once, then back to the queue. The  */
/*  ‹ › bar walks the moments in either direction; from 1024px the rail on    */
/*  the left is the queue.                                                     */
/* -------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import CoachJudgeSheet, { type JudgeClip } from "./CoachJudgeSheet";
import CoachReadSheet from "./CoachReadSheet";
import CoachAnswerOverlay, { type AnswerOutcome } from "./CoachAnswerOverlay";
import CoachTakeWordSheet from "./CoachTakeWordSheet";
import CoachWalkRail from "./CoachWalkRail";
import type { PatternOption } from "./CoachHomeSheet";
import { fetchCoachReviewSession } from "@/services/api/coachReview";
import { listSpeakingErrors } from "@/services/api/speakingErrors";
import type { CoachExerciseRequest } from "@/services/api/coachExerciseRequest";
import type { MomentRead } from "@/services/api/coachWalk";
import {
  afterJudged, afterNothingToAdd, nextOpenIndex, readSlideFor, replaceMoment,
  type AnswerValue, type MomentKind, type QueueMoment, type QueueSpeaker, type QueueTake,
  type ReadSlide,
} from "@/lib/willab/coachWalk";
import { CUE_OPTIONS } from "@/lib/willab/coachAnswer";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";
import type { Pager } from "../feedbackPager";

/** Judge, Read, Words, Video, Home: the bar counts screens, never anything
 *  else (AC-9). */
const ANSWER_SCREENS = 3;

function Toast({ text }: { text: string }) {
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <span className="rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-lg">
        {text}
      </span>
    </div>
  );
}

type Answering = { request: CoachExerciseRequest; read: MomentRead };

function toastFor(outcome: AnswerOutcome, pseudonym: string): string {
  if (outcome === "shared_library") return COPY.toastShared(pseudonym);
  if (outcome === "shared") return COPY.toastSharedOnly(pseudonym);
  return COPY.toastLibraryOnly;
}

export default function CoachWalkOverlay({
  speakers,
  speaker,
  take,
  startSnippetId,
  onClose,
  onOpenMoment,
  onChanged,
}: {
  /** The whole queue, for the desktop rail. */
  speakers: QueueSpeaker[];
  speaker: QueueSpeaker;
  take: QueueTake;
  startSnippetId: string;
  onClose: () => void;
  /** The rail opens another take's moment through the host. */
  onOpenMoment: (speaker: QueueSpeaker, take: QueueTake, snippetId: string) => void;
  /** Something was saved: the host may refresh the queue. */
  onChanged: () => void;
}) {
  const [moments, setMoments] = useState<QueueMoment[]>(take.moments);
  const [cursor, setCursor] = useState(() =>
    Math.max(0, take.moments.findIndex((m) => m.snippetId === startSnippetId)),
  );
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [clips, setClips] = useState<Record<string, JudgeClip>>({});
  /** The slide each moment began on, for Read only (B5). */
  const [slides, setSlides] = useState<Record<string, ReadSlide>>({});
  const [errors, setErrors] = useState<PatternOption[]>([]);
  const [answering, setAnswering] = useState<Answering | null>(null);
  const [wordStep, setWordStep] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachReviewSession(take.sessionId).then((session) => {
      if (cancelled || !session) return;
      const next: Record<string, JudgeClip> = {};
      const pictures: Record<string, ReadSlide> = {};
      for (const s of session.snippets) {
        next[s.id] = { src: s.audioRef, startOffsetMs: s.startOffsetMs, durationMs: s.durationMs };
        const picture = readSlideFor(session.presentationRef, s.slide);
        if (picture) pictures[s.id] = picture;
      }
      setClips(next);
      setSlides(pictures);
    });
    void listSpeakingErrors().then((result) => {
      if (cancelled || !result.ok) return;
      setErrors(result.data.filter((e) => e.active).map((e) => ({
        key: e.errorId, label: e.label, locked: e.status !== "detected",
      })));
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

  function moveOn(updated: QueueMoment[]): void {
    const next = nextOpenIndex(updated, cursor);
    if (next !== -1) {
      setCursor(next);
      return;
    }
    // The last open moment is done: the one optional word for the Take.
    setWordStep(true);
  }

  function judged(value: AnswerValue): void {
    if (!moment) return;
    setAnswers((prev) => ({ ...prev, [moment.snippetId]: value }));
    setMoments((prev) => replaceMoment(prev, afterJudged(moment)));
    setToast(COPY.toastJudged);
    onChanged();
  }

  function nothingToAdd(): void {
    if (!moment) return;
    const updated = replaceMoment(moments, afterNothingToAdd(moment));
    setMoments(updated);
    setToast(COPY.toastNothingToAdd);
    onChanged();
    moveOn(updated);
  }

  function answered(outcome: AnswerOutcome): void {
    if (!moment) return;
    const updated = replaceMoment(moments, { ...moment, state: "answered" });
    setMoments(updated);
    setAnswering(null);
    setToast(toastFor(outcome, speaker.pseudonym));
    onChanged();
    moveOn(updated);
  }

  const needsJudging = moment.state === "judge_it" && !answers[moment.snippetId];
  const rail = (
    <CoachWalkRail
      speakers={speakers}
      currentTake={take}
      currentMoments={moments}
      currentSnippetId={moment.snippetId}
      onOpenMoment={(s, t, snippetId) => {
        if (t.sessionId === take.sessionId) {
          const index = moments.findIndex((m) => m.snippetId === snippetId);
          if (index >= 0) { setAnswering(null); setWordStep(false); setCursor(index); }
          return;
        }
        onOpenMoment(s, t, snippetId);
      }}
    />
  );

  let sheet: React.ReactNode;
  if (wordStep) {
    sheet = (
      <CoachTakeWordSheet
        sessionId={take.sessionId}
        pseudonym={speaker.pseudonym}
        takeIndex={take.takeIndex}
        pager={{ ...pager, index: moments.length, total: moments.length + 1, onNext: onClose }}
        onClose={onClose}
        onSkip={onClose}
        onSent={() => { setToast(COPY.toastWordSent(speaker.pseudonym)); onChanged(); onClose(); }}
      />
    );
  } else if (answering) {
    const kind: MomentKind = answering.request.kind;
    sheet = (
      <CoachAnswerOverlay
        key={`answer:${moment.snippetId}`}
        kind={kind}
        context={{
          moment: {
            sessionId: take.sessionId, snippetId: moment.snippetId,
            requestId: answering.request.id, pseudonym: speaker.pseudonym,
            passage: answering.read.passage, spotted: answering.request.spotted,
          },
          errors, cues: CUE_OPTIONS,
        }}
        baseIndex={2}
        baseTotal={2 + ANSWER_SCREENS}
        onClose={() => setAnswering(null)}
        onDone={answered}
      />
    );
  } else if (needsJudging) {
    sheet = (
      <CoachJudgeSheet
        key={`judge:${moment.snippetId}`}
        snippetId={moment.snippetId}
        pager={pager}
        clip={clips[moment.snippetId] ?? null}
        onClose={onClose}
        onJudged={judged}
        railed
      />
    );
  } else {
    sheet = (
      <CoachReadSheet
        key={`read:${moment.snippetId}`}
        sessionId={take.sessionId}
        snippetId={moment.snippetId}
        pseudonym={speaker.pseudonym}
        pager={pager}
        coachAnswer={answers[moment.snippetId] ?? null}
        slide={slides[moment.snippetId] ?? null}
        onClose={onClose}
        onAnswer={(request, read) => setAnswering({ request, read })}
        onNothingToAdd={nothingToAdd}
        onNext={() => moveOn(moments)}
        railed
      />
    );
  }

  return (
    <>
      {rail}
      {sheet}
      {toast ? <Toast text={toast} /> : null}
    </>
  );
}
