"use client";

/** The exercise step's state machine, lifted out of the card that used to own it.
 *
 *  WHY IT MOVED (founder 2026-09-16, §3). The practice used to be a self-
 *  contained card nested under an answered Confident Voice screen, drawing its
 *  own buttons. The ladder gives every screen ONE footer, owned by the sheet —
 *  so the sheet has to know which of the two screens is showing and what the
 *  pill should say, and the component can no longer draw its own. The state
 *  machine is the part worth keeping, so it moves here and the rendering goes
 *  to the sheet.
 *
 *  TWO SCREENS, NOT FOUR. The old machine had `offer | practice | final |
 *  closed`. `practice` was a screen with a passage to read and a per-attempt
 *  review; §3 deletes both — "Practise records in place; there is no passage
 *  screen and no per-attempt screen". Recording is now something that happens
 *  ON the offer screen rather than a destination, so `recording` here is a
 *  flag on the offer, not a third view.
 *
 *  PRACTISE AGAIN STARTS A NEW RUN. This is the behaviour §3 calls out by
 *  name, and it is a real fix rather than a rename. The old `begin()` did
 *
 *      setView(opened.finalReady ? "final" : "practice")
 *
 *  so once an attempt was judged-ready, pressing Practise took you BACK to the
 *  judgement of the attempt you had just walked away from. `offer.resume` did
 *  the same thing on mount. Both are gone: begin() always records. Attempts
 *  stay capped by `attemptsRemaining`, and this is what spends one.
 *
 *  WHAT THE SERVER DECIDES AND DOES NOT SAY. Every attempt is assessed
 *  server-side, and the server picks which one is worth judging. That happens
 *  between the two screens with nothing drawn for it, so an attempt it rejects
 *  lands back on the offer with no message — indistinguishable from a
 *  recording that failed. Known and accepted (§3), flagged for testing rather
 *  than solved.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import type {
  ConfidentVoicePracticeOffer,
  DocumentSuggestion,
} from "@/services/api/idealText";
import {
  finishConfidencePractice,
  judgeConfidencePracticeAttempt,
  startConfidencePractice,
  uploadConfidencePracticeAttempt,
  type ConfidencePractice,
  type ConfidencePracticeAttempt,
  type PracticeAnswer,
} from "@/services/api/confidentVoicePractice";

type Evidence = NonNullable<DocumentSuggestion["evidence"]>;

/** Which of the step's two screens the sheet should draw. */
export type ExerciseScreen = "offer" | "judgement";

/** What a finished practice hands the sheet (contract 29a, founder
 *  2026-09-25). `adopted`: the practised passage now reads as this attempt,
 *  and `paragraph` is the paragraph's new words. `attemptWords`: what was
 *  said in the attempt, which the helper-words step taps from. */
export interface PracticeOutcome {
  practiceId: string;
  adopted: boolean;
  paragraph: string | null;
  attemptWords: string | null;
}

/** The attempt the judgement screen asks about: the latest one while it is
 *  unjudged (Q17 A), else the server's frozen comparison attempt. */
export function attemptToJudge(
  practice: ConfidencePractice | null,
): ConfidencePracticeAttempt | null {
  if (!practice) return null;
  return (
    practice.attempts.find((a) => a.id === practice.judgeableAttemptId) ??
    practice.strongestAttempt
  );
}

export interface ConfidenceExercise {
  screen: ExerciseScreen;
  /** True while the mic is live on the offer screen. The pill becomes Stop. */
  recording: boolean;
  /** True once the speaker has come back from the judgement without answering.
   *  The only thing it changes is the pill: Practise -> Practise again. */
  returned: boolean;
  busy: boolean;
  error: string | null;
  /** The attempt the server chose as worth judging — the orange card's audio. */
  corrected: ConfidencePracticeAttempt | null;
  attemptsRemaining: number;
  /** Closed server-side: the step is done and the ladder moves on. */
  finished: boolean;
  /** Record, or record again. Never resumes a judged attempt. */
  practise: () => void;
  /** Stop the mic; the attempt uploads and the server assesses it. */
  stop: () => void;
  /** Decline the exercise. Closes the practice row so it does not return. */
  notNow: () => Promise<void>;
  /** Judge the latest attempt with one of the five answers (Q17 A). No or
   *  Audio unclear with attempts left lands back on the offer to practise
   *  again; anything else finishes the step. */
  finish: (answer: PracticeAnswer) => Promise<void>;
  /** Leave the judgement unanswered and land on the offer. */
  back: () => void;
}

export function useConfidenceExercise(args: {
  snippetId: string | null;
  offer: ConfidentVoicePracticeOffer | null;
  evidence: Evidence | null;
  originalUserAnswer: "yes" | "no";
  /** Called once the practice row closes, so the ladder can advance. */
  onFinished: (
    answer: PracticeAnswer | null,
    outcome?: PracticeOutcome,
  ) => void;
}): ConfidenceExercise {
  const { snippetId, offer, evidence, originalUserAnswer, onFinished } = args;
  const mic = useDualCaptureMic({ transcript: false });
  const [practice, setPractice] = useState<ConfidencePractice | null>(null);
  const [screen, setScreen] = useState<ExerciseScreen>("offer");
  const [returned, setReturned] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadedBlob = useRef<Blob | null>(null);
  // onFinished is the host's callback and may be a fresh closure each render;
  // holding it in a ref keeps the upload effect from re-firing on every render.
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const ensurePractice = useCallback(async (): Promise<ConfidencePractice | null> => {
    if (practice) return practice;
    if (!snippetId || !offer || !evidence) return null;
    setBusy(true);
    setError(null);
    const result = await startConfidencePractice(
      snippetId,
      offer,
      evidence,
      originalUserAnswer,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't open the practice. Try again.");
      return null;
    }
    setPractice(result.practice);
    return result.practice;
  }, [practice, snippetId, offer, evidence, originalUserAnswer]);

  const submitAttempt = useCallback(
    async (audio: Blob, durationSec: number) => {
      const opened = await ensurePractice();
      if (!opened) return;
      setBusy(true);
      setError(null);
      const result = await uploadConfidencePracticeAttempt(
        opened.id,
        audio,
        durationSec,
      );
      setBusy(false);
      mic.cancel();
      setRecording(false);
      if (!result.ok) {
        setError(result.error ?? "Couldn't assess that attempt. Try again.");
        return;
      }
      setPractice(result.practice);
      // Every attempt is judged as soon as it is recorded (Q17 A, founder
      // 2026-09-25). An attempt the server rejected is not judgeable, and we
      // stay on the offer — see the module header.
      if (result.practice.judgeableAttemptId) setScreen("judgement");
    },
    [ensurePractice, mic],
  );

  useEffect(() => {
    if (mic.state.status !== "stopped") return;
    if (uploadedBlob.current === mic.state.audioBlob) return;
    uploadedBlob.current = mic.state.audioBlob;
    void submitAttempt(mic.state.audioBlob, mic.state.durationSec);
    // submitAttempt is stable per practice; the blob identity is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.state]);

  const practise = useCallback(() => {
    // Deliberately NOT `finalReady ? judgement : record`. That conditional is
    // what made Practise resume a judged attempt instead of recording a new
    // one. Recording is the only thing this button does.
    setError(null);
    setScreen("offer");
    setRecording(true);
    void mic.start();
  }, [mic]);

  const stop = useCallback(() => {
    void mic.stop();
  }, [mic]);

  const notNow = useCallback(async () => {
    mic.cancel();
    setRecording(false);
    const opened = await ensurePractice();
    if (!opened) {
      // Nothing was ever opened server-side, so there is nothing to close and
      // nothing that would return next Take. Advancing is the honest outcome.
      setFinished(true);
      finishedRef.current(null);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await finishConfidencePractice(opened.id, { action: "dismiss" });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that choice. Try again.");
      return;
    }
    setPractice(result.practice);
    setFinished(true);
    finishedRef.current(null);
  }, [ensurePractice, mic]);

  const finish = useCallback(
    async (answer: PracticeAnswer) => {
      const target = attemptToJudge(practice);
      if (!practice || !target || busy) return;
      setBusy(true);
      setError(null);
      const result = await judgeConfidencePracticeAttempt(
        practice.id,
        target.id,
        answer,
      );
      setBusy(false);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save that answer. Try again.");
        return;
      }
      setPractice(result.practice);
      if (result.outcome === "again") {
        // No or Audio unclear with attempts left: back to the offer, where
        // the pill reads Practise again (29a).
        setReturned(true);
        setScreen("offer");
        return;
      }
      setFinished(true);
      // The answer is also what decides the helper-words step and the Lock
      // (§4), so the host is told WHICH answer and what it did.
      finishedRef.current(answer, {
        practiceId: practice.id,
        adopted: result.adopted,
        paragraph: result.paragraph,
        attemptWords: result.attemptWords,
      });
    },
    [practice, busy],
  );

  const back = useCallback(() => {
    mic.cancel();
    setRecording(false);
    setReturned(true);
    setScreen("offer");
  }, [mic]);

  return {
    screen,
    recording,
    returned,
    busy,
    error,
    corrected: attemptToJudge(practice),
    // Only the practice row carries the cap; before one is opened the count is
    // unknown rather than zero, and the offer screen does not surface it.
    attemptsRemaining: practice?.attemptsRemaining ?? 0,
    finished,
    practise,
    stop,
    notNow,
    finish,
    back,
  };
}
