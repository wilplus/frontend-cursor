"use client";

import { reasonRuns, type PraiseReason, type WalkPraiseReasons } from "@/lib/willab/praiseReason";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { answerBody } from "@/lib/willab/walkThread";
import CoachVideo from "../CoachVideo";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import { useGuestBlock } from "../GuestSignUpDialog";
import WalkStage from "./WalkStage";
import WalkThread, { WalkPart, WalkSpeakerBubble, WalkThreadMark } from "./WalkThread";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage, { WalkNewWords } from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkWordPicker from "./WalkWordPicker";
import { practiseThreadFooter, practiseThreadItem, type PractiseScreenCtx } from "./WalkPractiseScreens";
import { useWalkPractise, type WalkPractise } from "./useWalkPractise";
import WalkOthers from "./WalkOthers";
import WalkSummary from "./WalkSummary";
import WalkAiVoice, { aiVoiceShown, type AiVoiceLines } from "./WalkAiVoice";
import { useWalkLines } from "./useWalkLines";
import type { WalkJudgementSave } from "./useWalkJudging";
import type { WalkJournalPost } from "./WalkJudgementScreens";
import type { SayLine, WalkBankKey, WalkLinesIO } from "@/lib/willab/walkLines";
import { walkSig, type WalkDir } from "@/lib/willab/walkMotion";
import { WALK_MAX_TRIES, type WalkStep } from "@/lib/willab/walkPlan";
import {
  encourageLine,
  improvedLine,
  loopEnd,
  thanksLine,
  threadPraised,
  threadShownEnd,
  threadStart,
  triesMade,
  withNextTry,
} from "@/lib/willab/walkPractise";
import type { WalkPractiseIO } from "@/services/api/walkPractise";
import type { FeedbackWalkModel, FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import type { ClearerPiece } from "@/lib/willab/clearerPieces";
import { phraseTokens, selectionSpan, type PhraseSelection } from "@/lib/willab/phraseTokens";
import type { RootPhraseSpan } from "@/services/api/partLock";

/* -------------------------------------------------------------------------- */
/*  FeedbackWalk — the Feedback walk, the lens on (founder lock 2026-10-12,    */
/*  moment and feedback chat; prototype v31, one to one).                      */
/*                                                                            */
/*  The production controller. It draws the steps of the walk's plan           */
/*  (walkPlan.ts, feedbackWalkModel.ts) as ONE CHAT (founder 2026-10-20,      */
/*  WIL-89, WalkThread): every step reached is a part of one thread that      */
/*  grows downwards, nothing swaps. The overlay slides in from the right      */
/*  (0.34 s) and ✕ swipes it out to the left (0.28 s), with WalkStage; each   */
/*  new step's bubbles land one after the other; every move is instant with   */
/*  reduce motion.                                                            */
/*                                                                            */
/*  Each step is a grey bubble on the left whose first line is the step's     */
/*  name at regular weight, with the speaker's own clip as an orange bubble   */
/*  on the right where there is one:                                          */
/*                                                                            */
/*    coachnote  "Your coach", the video inside the bubble, the words;        */
/*               Continue                                                     */
/*    praise     the clip, "Good job" and one signed line; Next               */
/*    helpers    "Choose your helper words", the picker filling the screen;   */
/*               "Use these helper words" and Skip ("Keep these" once chosen) */
/*    clearer    the clip with the speaker's words (what goes crossed out),   */
/*               "Clearer version", the opener, the new words (what arrives   */
/*               in orange), the question; "Accept and practise" opens the    */
/*               recorder on the new words, "Keep my words" on the speaker's  */
/*               own sentence with Line A                                     */
/*    exVideo    the clip, "Exercise", the 4:5 video when there is one, the   */
/*               instruction (else Line A); Practise with the red dot, Skip   */
/*    practise…  every practise loop is one thread: the words to say, each    */
/*               try, the check and the answer; the recorder is the dock      */
/*               (WalkPractiseScreens)                                        */
/*    others     other speakers' moments to judge, one per try (WalkOthers)   */
/*    summary    the closing summary, "Take N"; Next closes the walk onto the */
/*               Ideal Text (WalkSummary)                                     */
/*                                                                            */
/*  ‹ › scroll the thread to the step before or after (WalkThread); they      */
/*  never answer and never close. The pill alone moves the journey on, to the */
/*  next step that waits, and the speaker's choice lands as their own bubble. */
/*  A step reopened (the finished walk played again) shows its answer as a    */
/*  "✓ …" line over a black Next. Helper words stay editable on the newest    */
/*  part (lock, section 2.3).                                                 */
/*                                                                            */
/*  Every word on these screens is a signed one (CHUNK_SHEET_COPY, WALK_COPY) */
/*  or the caller's (the coach's note, the praise line the item carries);     */
/*  nothing here makes one up. No number, read or machine pick is drawn: the  */
/*  only figures are the moment's position and the word count (AC-9).        */
/*                                                                            */
/*  A guest reads every screen; a pick or a save opens the sign-up dialog     */
/*  and writes nothing (N32.5).                                               */
/* -------------------------------------------------------------------------- */

/** "Open the walk at step `at`". A new `seq` is a new request; `how` is the
 *  move that brought the speaker there (‹ or › across the walk's models). */
export type FeedbackWalkRequest = { seq: number; at: number; how?: WalkDir };

/** The coach's word for the Take, as the walk shows it. */
export type FeedbackWalkCoachNote = {
  text: string | null;
  videoUrl: string | null;
  takeIndex: number | null;
};

/** What a helper-words save carries: the paragraph, the span in the words
 *  the picker numbered, and those words, so the host can tell when the
 *  paragraph has changed under the walk. */
export type FeedbackWalkHelperWords = {
  partId: string;
  span: RootPhraseSpan;
  paragraphText: string;
};

type Props<R> = {
  /** The walk, live. It is held still from the moment the walk opens until
   *  it closes, so a re-read of the page cannot move the screen under the
   *  speaker (the pager's frozen list, the same rule). */
  model: FeedbackWalkModel<R>;
  request: FeedbackWalkRequest | null;
  coachNote: FeedbackWalkCoachNote | null;
  /** The project's first Take. */
  firstTake: boolean;
  /** The Take reviewed, for the summary's "Take N". */
  takeIndex?: number | null;
  /** A guest known to the caller. Without it the page's guest gate decides
   *  (GuestGateContext), exactly as the Feedback sheet asks it. */
  guest?: boolean;
  /** Opens the sign-up dialog for a guest known to the caller. */
  onGuest?: () => void;
  onSaveHelperWords: (save: FeedbackWalkHelperWords) => void;
  /** "Accept and practise" (or "Accept") on a clearer version: the host
   *  writes the speaker's decision through the accept lane. The walk moves
   *  on at once; it never waits on the write. */
  onAcceptClearer?: (item: R) => void;
  /** "Keep my words": the host records the decline; the speaker's own
   *  sentence is practised with Line A. */
  onKeepWords?: (item: R) => void;
  /** The practise's calls (open, upload, check). Without them a practise
   *  screen is never reached: "Accept and practise" goes past it. */
  practise?: WalkPractiseIO<R> | null;
  /** O5's limit on the machine's read; tests shorten it. */
  readLimitMs?: number;
  /** Judging one's own moments is gone from the walk (lock 2026-10-12,
   *  section 2); these are kept for callers that still pass them. */
  onJudge?: (save: WalkJudgementSave<R>) => void;
  onSkipJudging?: (items: R[]) => void;
  journal?: WalkJournalPost | null;
  /** The closing summary's words (lock, section 3); null: the step is
   *  skipped. */
  summary?: (() => Promise<string | null>) | null;
  /** The walk ran out: the page underneath. */
  onEnd: () => void;
  /** Next on a step played again: true when the host moved the walk itself
   *  (a step still waits, so Next goes there; founder 2026-10-14). */
  onForward?: () => boolean;
  /** ✕: the overlay sinks back to the page. */
  onClose?: () => void;
  /** The line bank's memory (D-FW-3): the walk reads which line each bank
   *  says next and records each one it shows, so a line is never said twice
   *  in a row across Takes. Absent: each bank starts at its first line. */
  lines?: WalkLinesIO | null;
  /** A screen of the walk is on: the coach's note, or a screen of moment
   *  `moment`. The host tells the server what was shown (the Lounge's
   *  "new", D-FW-19). Nothing is drawn from it. `ai`: the AI bubble the
   *  screen shows in place of the locked one (N71), so the chat says the
   *  same; a screen still waiting on its clip is told once the clip is in. */
  onShown?: (
    step: WalkStep,
    moment: FeedbackWalkMoment<R> | null,
    say: (bank: WalkBankKey) => string,
    ai?: WalkAiShown | null,
    /** A try's answer: the line the screen shows, so the chat says the
     *  same (founder 2026-10-20). */
    line?: string | null,
  ) => void;
  /** The speaker answered a step (not a replay): the host shows the answer
   *  as their own bubble in the chat, as the thread does. */
  onAnswer?: (step: WalkStep, value: string) => void;
  /** Another speaker's moment shown (`answer` null) or answered: the host
   *  posts it to the chat. Nothing is drawn from it. */
  onOthers?: (at: number, of: number, from: string | null, answer: string | null) => void;
  /** Reasons for green moments written after the page was read (founder
   *  2026-10-18): drawn once they arrive, without moving the walk. */
  reasons?: WalkPraiseReasons | null;
  /** How many of other speakers' moments the speaker already judged in this
   *  walk, as the chat holds their answers: the judging reopened from the
   *  Lounge shows them answered (founder 2026-10-18). */
  othersJudged?: number;
};

/** The AI bubble a screen showed, for the chat. */
export type WalkAiShown = AiVoiceLines & { practiceId: string };

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

/** The steps a practise is opened from; ✕ on the recorder goes back there. */
const OPENERS = new Set(["clearer", "exVideo", "encourage", "late"]);

/** One part of the thread: a step reached, by its place in the plan. */
type ThreadPart = { key: string; at: number };

/** The parts of the thread, oldest first: every step reached up to
 *  `head`, a practise loop as one part that grows, the page's hidden steps
 *  left out (founder 2026-10-20, the lens as one chat). Pure. */
export function walkThreadParts(plan: readonly WalkStep[], head: number): ThreadPart[] {
  const out: ThreadPart[] = [];
  for (let i = 0; i <= head && i < plan.length; i += 1) {
    const s = plan[i];
    if (!s || s.overlay === false) continue;
    const start = threadStart(plan, i);
    if (start < 0) {
      out.push({ key: `${i}:${s.key}`, at: i });
      continue;
    }
    const key = `thread:${start}`;
    const last = out[out.length - 1];
    if (last?.key === key) last.at = i;
    else out.push({ key, at: i });
  }
  return out;
}

/** The plan with the practise step after `at` set to `kind`: "Accept and
 *  practise" says the new words, "Keep my words" the speaker's own. Null
 *  when no practise follows (nothing to open it on). Pure. */
function withPractiseKind(plan: readonly WalkStep[], at: number, kind: "words" | "keep"): WalkStep[] | null {
  const next = plan[at + 1];
  if (next?.key !== "practise" || next.moment !== plan[at]?.moment) return null;
  return plan.map((s, i) => (i === at + 1 ? { ...s, kind } : s));
}

export default function FeedbackWalk<R = unknown>({
  model,
  request,
  coachNote,
  takeIndex = null,
  guest = false,
  onGuest,
  onSaveHelperWords,
  onAcceptClearer,
  onKeepWords,
  practise: practiseIO = null,
  readLimitMs,
  summary = null,
  onEnd,
  onForward,
  onClose,
  lines: linesIO = null,
  onShown,
  onAnswer,
  onOthers,
  reasons = null,
  othersJudged = 0,
}: Props<R>) {
  const liveModel = useRef(model);
  liveModel.current = model;
  const [walk, setWalk] = useState<FeedbackWalkModel<R>>(model);
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<Record<string, PhraseSelection | null>>({});
  // The answer given to each step in this opening, by the step's identity.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const guestBlock = useGuestBlock();

  const requestRef = useRef(request);
  requestRef.current = request;
  const seq = request?.seq ?? null;
  const resetRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const asked = requestRef.current;
    if (seq === null || !asked) return;
    const opened = liveModel.current;
    resetRef.current();
    setWalk(opened);
    setPicks(replayPicks(opened));
    setAnswers({});
    setAt(asked.at);
  }, [seq]);

  const plan = walk.plan;
  const step = plan[at] ?? plan[0];

  // `how` is kept for the callers; the thread does not slide (2026-10-20).
  const go = useCallback((to: number, _how?: WalkDir) => setAt(to), []);
  /** Move to `to` on `steps`; the page underneath ends the walk. A try
   *  played again is never stood on: its recorder and check are passed over
   *  to the answer it got (walk first, 2026-10-14). */
  const land = useCallback(
    (steps: readonly WalkStep[], to: number, how: WalkDir | undefined) => {
      const clamp = (i: number) => Math.max(0, Math.min(i, steps.length - 1));
      let at2 = clamp(to);
      while (steps[at2]?.replay && (steps[at2].key === "practise" || steps[at2].key === "processing")) at2 = clamp(at2 + 1);
      go(at2, how);
      if (steps[at2]?.overlay === false) onEnd();
    },
    [go, onEnd],
  );
  const forward = useCallback(() => {
    if (onForward?.()) return;
    land(plan, at + 1, "forward");
  }, [at, plan, land, onForward]);
  const atNow = useRef(at);
  atNow.current = at;
  /** Moves on from `step` only while the walk still stands on it: a screen
   *  that finishes by itself may be drawn twice while the stage moves. */
  const forwardFrom = (step: WalkStep) => {
    const here = plan.indexOf(step);
    if (here === atNow.current) land(plan, here + 1, "forward");
  };
  /** The practise lays a new plan in as the machine answers. */
  const relay = useCallback(
    (steps: WalkStep[], to: number, how: WalkDir) => {
      setWalk((w) => ({ ...w, plan: steps }));
      land(steps, to, how);
    },
    [land],
  );

  /** A guest's pick or save asks to sign up, and nothing is written. */
  const blocked = useCallback(
    (s: WalkStep): boolean => {
      if (guest || s.readOnly) {
        if (onGuest) onGuest();
        else guestBlock();
        return true;
      }
      return guestBlock();
    },
    [guest, onGuest, guestBlock],
  );

  const replayTries = walk.replay?.tries;
  const practise = useWalkPractise<R>({
    io: practiseIO,
    plan,
    at,
    moments: walk.moments,
    blocked,
    relay,
    readLimitMs,
    replayPracticeOf: (moment) => replayTries?.[moment]?.practiceId,
  });
  // What the speaker now sees, for the host (D-FW-19): only once the walk
  // was asked open, and only an overlay screen; with its AI bubble, once
  // the screen knows whether it has one.
  const ai = step?.moment != null ? aiVoiceShown(plan, at, practise.aiVoiceOf(step.moment)) : null;
  const aiPractice = step?.moment != null && ai && ai !== "pending" ? practise.aiVoicePracticeOf(step.moment) : undefined;
  const aiState = step?.moment != null ? practise.aiVoiceOf(step.moment) : undefined;
  const aiKey = ai === "pending" ? "pending" : `${aiState?.demo ?? ""}|${aiState?.clip?.state ?? ""}|${aiPractice ?? ""}|${ai?.line ?? ""}`;
  const walkLines = useWalkLines(linesIO);
  const { say: sayLine } = walkLines;
  const aiRef = useRef<WalkAiShown | null>(null);
  aiRef.current = ai && ai !== "pending" && aiPractice ? { ...ai, practiceId: aiPractice } : null;
  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  useEffect(() => {
    if (seq === null || !step || step.overlay === false || aiKey === "pending") return;
    // The Exercise screen's clip is still being asked: told once it is known.
    if (step.key === "exVideo" && step.moment != null && practise.aiVoiceAsking(step.moment)) return;
    const moment = step.moment != null ? (walk.moments[step.moment] ?? null) : null;
    const line =
      step.key === "improved"
        ? improvedLine(plan, at)
        : step.key === "encourage"
          ? encourageLine(plan, at)
          : step.key === "thanks"
            ? thanksLine(plan, at)
            : null;
    shownRef.current?.(step, moment, (bank) => sayLine(step, bank), aiRef.current, line);
    // practise.aiVoiceAsking is stable; aiKey changes when the answer lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step, walk.moments, aiKey]);
  resetRef.current = () => {
    practise.reset();
    walkLines.reopen();
  };
  // A line screen on screen is recorded as said (D-FW-3).
  const { onScreen } = walkLines;
  useEffect(() => {
    if (seq !== null && step && step.overlay !== false) onScreen(step);
  }, [seq, step, onScreen]);
  const close = useCallback(() => {
    practise.cancel();
    go(0, undefined);
    onClose?.();
  }, [practise, go, onClose]);
  /** Past this moment's practise: Skip on an exercise, or no practise to do. */
  const pastLoop = useCallback(() => land(plan, loopEnd(plan, at), "forward"), [plan, at, land]);

  const answer = (s: WalkStep, value: string) => {
    setAnswers((a) => ({ ...a, [walkSig(s)]: value }));
    if (!s.replay) onAnswer?.(s, value);
  };
  /** The answer a step was given: in this opening, or as the replay knows
   *  it (a clearer version's decision; an exercise's practise). */
  const answered = (s: WalkStep): string | null => {
    const given = answers[walkSig(s)];
    if (given) return given;
    if (!s.replay) return null;
    if (s.key === "clearer") return walk.moments[s.moment ?? -1]?.clearer?.decided ?? "answered";
    // A "not yet" played again: practised again when a try follows it, else
    // skipped there.
    if (s.key === "encourage") {
      const next = plan[plan.indexOf(s) + 1];
      return next?.key === "practise" && next.moment === s.moment ? "again" : "skip";
    }
    return "answered";
  };
  /** ✕ on the recorder: back to the step that opened it, unanswered; with
   *  none (a paragraph's own practise) the walk closes. */
  const backFromPractise = () => {
    const moment = plan[at]?.moment;
    for (let j = at - 1; j >= 0; j -= 1) {
      const s = plan[j];
      if (s.overlay === false) break;
      if (s.moment === moment && OPENERS.has(s.key)) {
        practise.cancel();
        setAnswers((a) => {
          const next = { ...a };
          delete next[walkSig(s)];
          return next;
        });
        go(j, "back");
        return;
      }
    }
    close();
  };

  const ctx: ScreenCtx<R> = {
    walk,
    reasons,
    at: (s) => plan.indexOf(s),
    head: at,
    coachNote,
    takeIndex,
    forward,
    forwardFrom,
    close,
    picks,
    answer,
    answered,
    pick: (s, next) => {
      if (blocked(s)) return;
      setPicks((p) => ({ ...p, [pickKey(s)]: next }));
    },
    save: (s, moment) => {
      if (blocked(s)) return;
      answer(s, "use");
      const picked = picks[pickKey(s)] ?? null;
      const span = selectionSpan(moment.paragraphText, phraseTokens(moment.paragraphText), picked);
      if (span) {
        onSaveHelperWords({ partId: moment.partId, span, paragraphText: moment.paragraphText });
      }
      forward();
    },
    accept: (s, moment) => {
      if (s.replay) return forward();
      if (blocked(s) || !moment.clearer) return;
      onAcceptClearer?.(moment.clearer.item);
      answer(s, "accept");
      // "Accept and practise" opens the recorder on the new words; it
      // records as it arrives. With no practise to do, the walk goes on.
      const next = practiseIO ? withPractiseKind(plan, at, "words") : null;
      if (next) relay(next, at + 1, "forward");
      else pastLoop();
    },
    keep: (s, moment) => {
      if (s.replay) return forward();
      if (blocked(s) || !moment.clearer) return;
      onKeepWords?.(moment.clearer.item);
      answer(s, "keep");
      // "Keep my words" practises the speaker's own sentence with Line A
      // (lock 2026-10-12, section 2.4).
      const next = practiseIO ? withPractiseKind(plan, at, "keep") : null;
      if (next) relay(next, at + 1, "forward");
      else pastLoop();
    },
    exercise: (s) => {
      if (s.replay) return forward();
      if (blocked(s)) return;
      answer(s, "go");
      // "Practise" opens the recorder on the exercise; it records as it
      // arrives. With no practise to do, the walk goes on.
      if (practiseIO) forward();
      else pastLoop();
    },
    practiseAgain: (s) => {
      // Practise from an answer in the thread (founder 2026-10-16): the next
      // try, after a "not yet" or a "Good job" alike, until the third.
      if (s.replay) return pastLoop();
      if (blocked(s)) return;
      const here = plan.indexOf(s);
      const next = practiseIO && here >= 0 ? withNextTry(plan, here) : null;
      if (!next) return pastLoop();
      answer(s, "again");
      relay(next, here + 1, "forward");
    },
    skipExercise: (s) => {
      if (s.replay) return forward();
      answer(s, "skip");
      pastLoop();
    },
    pastLoop,
    practise,
    summary,
    nav: (s, moment) => stepNav(ctx, s, moment),
    say: walkLines.say,
    onOthers,
    othersJudged,
  };

  // The walk is one chat (founder 2026-10-20): the stage moves only as the
  // lens opens and closes, never between steps; the thread grows inside it.
  const stage = { key: step.overlay === false ? "page" : "walk", overlay: step.overlay, head: at, seq };
  const frame = useRef<HTMLDivElement | null>(null);

  return (
    <div data-feedback-walk data-walk-step={step.key}>
      {/* The whole window on a wide screen, the words in the phone's column
          (globals.css, "Desktop"). */}
      <WalkStage
        screen={stage}
        render={(s, ghost) => (
          <WalkThread ghost={ghost} frame={frame} onClose={close}>
            {renderThread(ctx, s.head, s.seq, backFromPractise)}
          </WalkThread>
        )}
      />
    </div>
  );
}

/** Helper words are picked once per screen kind and moment: after a praise
 *  from the paragraph, after a praised try from the try's words. */
const pickKey = (step: WalkStep) => `${step.moment ?? -1}:${step.kind ?? ""}`;

/** The replayed walk's helper words as saved, drawn pressed and still
 *  editable (lock 2026-10-12, section 2.3); the live walk starts with none. */
function replayPicks(model: FeedbackWalkModel<unknown>): Record<string, PhraseSelection | null> {
  const out: Record<string, PhraseSelection | null> = {};
  for (const [moment, selection] of Object.entries(model.replay?.picks ?? {})) {
    out[pickKey({ key: "helpers", moment: Number(moment) })] = selection;
  }
  return out;
}

type ScreenCtx<R = unknown> = {
  walk: FeedbackWalkModel<R>;
  /** Where a step sits in the plan. */
  at: (step: WalkStep) => number;
  /** The newest step reached: the live part of the thread. */
  head: number;
  coachNote: FeedbackWalkCoachNote | null;
  takeIndex: number | null;
  /** The pill: on to the next step that waits. */
  forward: () => void;
  forwardFrom: (step: WalkStep) => void;
  close: () => void;
  picks: Record<string, PhraseSelection | null>;
  answer: (step: WalkStep, value: string) => void;
  answered: (step: WalkStep) => string | null;
  pick: (step: WalkStep, next: PhraseSelection | null) => void;
  save: (step: WalkStep, moment: FeedbackWalkMoment) => void;
  accept(step: WalkStep, moment: FeedbackWalkMoment<R>): void;
  keep(step: WalkStep, moment: FeedbackWalkMoment<R>): void;
  /** "Practise" under an exercise. */
  exercise: (step: WalkStep) => void;
  /** Practise under an answer in the Exercise thread: the next try. */
  practiseAgain: (step: WalkStep) => void;
  /** Skip under an exercise: past this moment's practise. */
  skipExercise: (step: WalkStep) => void;
  pastLoop: () => void;
  practise: WalkPractise;
  summary: (() => Promise<string | null>) | null;
  nav: (step: WalkStep, moment: FeedbackWalkMoment<unknown>) => WalkNav;
  /** The signed line a screen says (D-FW-3). */
  say: SayLine;
  onOthers?: (at: number, of: number, from: string | null, answer: string | null) => void;
  /** Green moments' reasons that arrived after the walk opened. */
  reasons: WalkPraiseReasons | null;
  othersJudged: number;
};

const noop = () => undefined;

/** A step's name: "Slide N" (founder 2026-10-15: no moment count), "Slide N
 *  · helper words" on the helper words. The thread's mark and bar say it;
 *  ‹ › are the thread's own (WalkThread). */
function stepNav(_ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment): WalkNav {
  const label = moment.slideLabel;
  const position =
    step.key === "helpers"
      ? label
        ? `${label} · ${WALK_COPY.navHelperWords}`
        : WALK_COPY.navHelperWords
      : label ?? undefined;
  return {
    label,
    index: 0,
    total: 1,
    position,
    onBack: noop,
    onNext: noop,
    backDisabled: true,
    nextDisabled: true,
  };
}

/** A step reopened: its answer as a line over a black Next. */
function Answered({ ctx, line }: { ctx: ScreenCtx; line: string }) {
  return (
    <WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }}>
      <p className="m-0 text-center text-[13px] text-muted-foreground">{line}</p>
    </WalkFooter>
  );
}

/** The speaker's own clip: the orange bubble on the right. */
function Clip({ moment, words }: { moment: FeedbackWalkMoment; words?: ReactNode }) {
  if (!moment.clip && !words) return null;
  return (
    <WalkPlayer
      look="me"
      seed={`moment-${moment.index}`}
      src={moment.clip?.src ?? null}
      startOffsetMs={moment.clip?.startOffsetMs}
      durationMs={moment.clip?.durationMs}
      label={moment.slideLabel ?? COPY.pagerMoment}
      words={words}
    />
  );
}

/** The coach's word for the Take: "Your coach", their video inside the
 *  bubble, then their words. */
function CoachNote(ctx: ScreenCtx, step: WalkStep) {
  const note = ctx.coachNote;
  const nav: WalkNav = {
    position: COPY.titleCoach,
    index: 0,
    total: 1,
    onBack: noop,
    onNext: noop,
    backDisabled: true,
    nextDisabled: true,
  };
  const ok = () => {
    ctx.answer(step, "ok");
    ctx.forward();
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={nav}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pillContinue, onClick: ok, testId: "walk-forward" }} />}
    >
      <WalkMessage coach wide>
        <span>{COPY.titleCoach}</span>
        {note?.videoUrl ? <CoachVideo src={note.videoUrl} className="my-2 w-full flex-none" /> : null}
        {note?.text ? <span>{note.text}</span> : null}
      </WalkMessage>
    </WalkOverlay>
  );
}

/** Why a green moment landed (founder 2026-10-18, prototype
 *  https://claude.ai/artifact/Wdaznuffm9SJEkkjPEuSaR v4): its own bubble,
 *  short paragraphs, the speaker's quoted words in orange, regular weight
 *  (lock 2026-10-12: no bold in any bubble). */
function PraiseReasonBubble({ reason }: { reason: PraiseReason }) {
  return (
    <WalkMessage>
      <div data-walk-reason className="flex flex-col gap-2.5">
        {reason.paragraphs.map((paragraph, i) => (
          <p key={i} className="m-0">
            {reasonRuns(paragraph, reason.quote).map((run, j) =>
              run.quoted ? (
                <span key={j} data-walk-quote className="text-accent-foreground">
                  {run.text}
                </span>
              ) : (
                <span key={j}>{run.text}</span>
              ),
            )}
          </p>
        ))}
      </div>
    </WalkMessage>
  );
}

/** A green moment: the clip, then "Good job" and one signed line, then why
 *  it landed. While its reason is still being written, the signed line
 *  stands alone; if none comes, the cue lines follow it as before. */
function Praise(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
  const ok = () => {
    ctx.answer(step, "ok");
    ctx.forward();
  };
  const clipId = moment.clip?.snippetId ?? null;
  const reason = moment.praiseReason ?? ctx.reasons?.of(clipId) ?? null;
  const waiting = !reason && (ctx.reasons?.waiting(clipId) ?? false);
  const words = reason || waiting ? (moment.praiseLead ?? moment.praiseWords) : moment.praiseWords;
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ok, testId: "walk-forward" }} />}
    >
      <Clip moment={moment} />
      <WalkMessage>
        <span>{moment.praiseTitle ?? COPY.titlePraise}</span>
        {words.length > 0 ? <span>{words.join(" ")}</span> : null}
      </WalkMessage>
      {reason ? <PraiseReasonBubble reason={reason} /> : null}
      <CoachAnswerBubble moment={moment} />
    </WalkOverlay>
  );
}

/** "Choose your helper words": the bubble, then the picker as a big bubble
 *  in the thread, live on the newest part only. */
function Helpers(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
  const picked = ctx.picks[pickKey(step)] ?? null;
  const live = ctx.at(step) === ctx.head;
  const words = moment.paragraphText;
  const given = ctx.answered(step) !== null || picked !== null && Boolean(ctx.walk.replay);
  const skip = () => {
    ctx.answer(step, "skip");
    ctx.forward();
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={
        <WalkFooter
          pill={{
            label: COPY.pillEmphasise,
            onClick: () => ctx.save(step, moment),
            disabled: picked === null,
            testId: "walk-forward",
          }}
          links={[
            given
              ? { label: WALK_COPY.keepThese, onClick: ctx.forward, testId: "walk-skip" }
              : { label: WALK_COPY.skip, onClick: skip, testId: "walk-skip" },
          ]}
        />
      }
    >
      <WalkMessage>
        <span>{COPY.titleEmphasis}</span>
        <span data-walk-subtitle>{WALK_COPY.helpersSubtitle}</span>
      </WalkMessage>
      <WalkWordPicker
        words={phraseTokens(words).map((token) => token.text)}
        selection={picked}
        onChange={(next) => {
          if (live) ctx.pick(step, next);
        }}
      />
    </WalkOverlay>
  );
}

/** The served words as runs: what goes crossed out, what arrives in
 *  orange (WalkNewWords colours the <em>). */
function pieces(list: readonly ClearerPiece[]) {
  return list.map((p, i) => {
    if (p.cut) return <s key={i}>{p.text}</s>;
    if (p.fresh) return <em key={i}>{p.text}</em>;
    return <span key={i}>{p.text}</span>;
  });
}

/** The clearer version: the speaker's clip with their words, then the
 *  opener, the new words and the question, from the signed bank. */
function Clearer<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const clearer = moment.clearer;
  if (!clearer) return null;
  const practiseOff = step.kind === "accept";
  const given = ctx.answered(step);
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={
        given ? (
          <Answered
            ctx={ctx}
            line={given === "accept" ? WALK_COPY.answeredAccepted : given === "keep" ? WALK_COPY.answeredKept : WALK_COPY.answered}
          />
        ) : (
          <WalkFooter
            pill={{
              label: practiseOff ? WALK_COPY.clearerAccept : COPY.pillAcceptPractise,
              onClick: () => ctx.accept(step, moment),
              testId: "walk-forward",
            }}
            links={[{ label: COPY.linkKeepMyWords, onClick: () => ctx.keep(step, moment), testId: "walk-keep" }]}
          />
        )
      }
    >
      <Clip moment={moment} words={pieces(clearer.before)} />
      {/* The coach's own clearer version is their bubble, with their photo
          and video, and is not said twice (founder 2026-10-20). */}
      <WalkMessage coach={clearer.byCoach === true} wide={clearer.byCoach === true}>
        <span>{COPY.cardClearerVersion}</span>
        {clearer.byCoach && moment.coachAnswer?.videoUrl ? (
          <CoachVideo src={moment.coachAnswer.videoUrl} className="my-2 w-full flex-none" />
        ) : null}
        <span>{ctx.say(step, "B13")}</span>
        <WalkNewWords>{pieces(clearer.after)}</WalkNewWords>
        {practiseOff ? null : <span>{ctx.say(step, "B14")}</span>}
      </WalkMessage>
      {clearer.byCoach ? null : <CoachAnswerBubble moment={moment} />}
    </WalkOverlay>
  );
}

/** The Exercise's bubbles: the clip, then the AI clip or the locked Exercise
 *  (with no exercise served, the locked screen with Line A). */
function ExerciseBody<R>({ ctx, step, moment }: { ctx: ScreenCtx<R>; step: WalkStep; moment: FeedbackWalkMoment<R> }) {
  const exercise = moment.exercise;
  return (
    <>
      <Clip moment={moment} />
      {aiExercise(ctx, step, moment) ?? (
        <WalkMessage coach={exercise?.byCoach === true} wide>
          <span>{COPY.titleExercise}</span>
          {exercise?.video ? (
            <CoachVideo
              src={exercise.video}
              className="my-2 w-full max-h-[300px] flex-none [&>video]:aspect-[4/5] [&>video]:max-h-[300px] [&>video]:object-cover"
            />
          ) : null}
          <span>{exercise?.instruction ?? WALK_COPY.lineA}</span>
        </WalkMessage>
      )}
      <CoachAnswerBubble moment={moment} />
    </>
  );
}

/** The coach's answer on a moment, its last bubble (founder 2026-10-14):
 *  "Your coach", their video when they sent one, their words, beside the
 *  coach's picture like their word for the Take (founder 2026-10-20). */
function CoachAnswerBubble({ moment }: { moment: FeedbackWalkMoment<unknown> }) {
  const answer = moment.coachAnswer;
  if (!answer) return null;
  return (
    <WalkMessage coach wide>
      <span>{COPY.titleCoach}</span>
      {answer.videoUrl ? <CoachVideo src={answer.videoUrl} className="my-2 w-full flex-none" /> : null}
      <span>{answer.text}</span>
    </WalkMessage>
  );
}

/** A moment only the coach speaks to (and every answered moment in the
 *  coach-only walk): the speaker's clip, then the coach's answer; Next. */
function CoachAnswer<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const ok = () => {
    ctx.answer(step, "ok");
    ctx.forward();
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ok, testId: "walk-forward" }} />}
    >
      <Clip moment={moment} />
      <CoachAnswerBubble moment={moment} />
    </WalkOverlay>
  );
}

/** The steps whose footer is the try's own: the recorder, the check, a
 *  late read. Every other step of the thread has the thread's footer. */
const TRY_FOOTER: ReadonlySet<string> = new Set(["practise", "processing", "late"]);

/** A practise loop as one thread (founder 2026-10-13, P1 A; 2026-10-16;
 *  every loop since 2026-10-20): the voice Exercise when there is one, then
 *  every try, check and answer under the one before. The whole history is
 *  on screen whichever of its steps the walk stands on, live or come back
 *  to; under it the thread's footer, or the try's own while one is in
 *  progress. */
function Thread<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>, practiseCtx: PractiseScreenCtx) {
  const at = ctx.at(step);
  const steps = ctx.walk.plan.slice(Math.max(0, threadStart(ctx.walk.plan, at)), threadShownEnd(ctx.walk.plan, at) + 1);
  const firstTry = steps.find((s) => s.key === "practise");
  const footer = TRY_FOOTER.has(step.key) ? practiseThreadFooter(practiseCtx, step) : <ThreadFooter ctx={ctx} step={step} />;
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={step.key === "practise" ? practiseCtx.back : ctx.close}
      footer={footer}
    >
      {steps.map((s, i) => (
        <Fragment key={`${s.key}:${s.attempt ?? 0}:${i}`}>
          {s.key === "exVideo" ? (
            <ExerciseBody ctx={ctx} step={s} moment={moment} />
          ) : (
            practiseThreadItem(practiseCtx, s, moment as FeedbackWalkMoment<unknown>, s === step, s === firstTry)
          )}
        </Fragment>
      ))}
    </WalkOverlay>
  );
}

/** Under the thread (founder 2026-10-18, prototype
 *  https://claude.ai/artifact/URLdtuBvG5rbrzFePfMcUv): until a Good job or
 *  the third try, only the white outlined Practise (Practise again after a
 *  try) with the red dot; then Next alone. The finished walk played again
 *  records nothing, so it has Next alone. */
function ThreadFooter<R>({ ctx, step }: { ctx: ScreenCtx<R>; step: WalkStep }) {
  const plan = ctx.walk.plan;
  const at = ctx.at(step);
  const tries = triesMade(plan, at);
  const more = !step.replay && tries < WALK_MAX_TRIES && !threadPraised(plan, at);
  const next = () => {
    ctx.answer(step, step.key === "improved" || step.key === "thanks" ? "ok" : "skip");
    ctx.pastLoop();
  };
  const practise = () => (tries === 0 ? ctx.exercise(step) : ctx.practiseAgain(plan[threadShownEnd(plan, at)]));
  if (!more) return <WalkFooter pill={{ label: COPY.pagerNext, onClick: next, testId: "walk-forward" }} />;
  const label = tries === 0 ? WALK_COPY.exercisePractise : COPY.pillPractiseAgain;
  return <WalkFooter dot outline pill={{ label, onClick: practise, testId: "walk-practise" }} />;
}

/** No video fits this problem: the AI clip in the video's place (N71), the
 *  bubble there at once with the typing dots while the clip is being made
 *  (founder 2026-10-15). Otherwise the locked Exercise. */
function aiExercise<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const state = ctx.practise.aiVoiceOf(moment.index);
  const ai = aiVoiceShown(ctx.walk.plan, ctx.at(step), state);
  if (!ai) return null;
  const lines = ai === "pending" ? { title: COPY.titleExercise, line: WALK_COPY.aiVoiceExercise, then: WALK_COPY.aiVoiceNow } : ai;
  return (
    <WalkAiVoice
      seed={`ai-ex-${moment.index}`}
      state={state}
      {...lines}
      arrive
      onPlay={() => ctx.practise.aiVoicePlayed(moment.index)}
    />
  );
}

/** Other speakers' moments, one per recorded try before this step (lock
 *  2026-10-12, 2.6): each Stop lays in a checking screen, so a try queued
 *  after a "Not yet" and skipped is not counted. */
function Others(ctx: ScreenCtx, step: WalkStep) {
  const tries = ctx.walk.plan.slice(0, ctx.at(step)).filter((s) => s.key === "processing").length;
  return (
    <WalkOthers
      testId={testId(step)}
      count={tries}
      judged={ctx.othersJudged}
      skip={Boolean(step.readOnly || step.replay)}
      onDone={() => ctx.forwardFrom(step)}
      onClose={ctx.close}
      onChat={ctx.onOthers}
    />
  );
}

/** The closing summary, the last lens step. */
function Summary(ctx: ScreenCtx, step: WalkStep) {
  return (
    <WalkSummary
      testId={testId(step)}
      takeIndex={ctx.takeIndex}
      fetchText={ctx.summary}
      onBack={noop}
      backDisabled
      onNext={() => ctx.forwardFrom(step)}
      onClose={ctx.close}
    />
  );
}

function renderScreen<R>(ctx: ScreenCtx<R>, step: WalkStep, backFromPractise: () => void): ReactNode {
  if (step.key === "coachnote") return CoachNote(ctx, step);
  if (step.key === "others") return Others(ctx, step);
  if (step.key === "summary") return Summary(ctx, step);
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  if (!moment) return null;
  if (step.key === "coach") return CoachAnswer(ctx, step, moment);
  if (step.key === "praise") return Praise(ctx, step, moment);
  if (step.key === "helpers") return Helpers(ctx, step, moment);
  if (step.key === "clearer") return Clearer(ctx, step, moment);
  const practiseCtx: PractiseScreenCtx = {
    plan: ctx.walk.plan,
    at: ctx.at,
    nav: ctx.nav,
    close: ctx.close,
    back: backFromPractise,
    forward: ctx.forward,
    answered: ctx.answered,
    answer: ctx.answer,
    say: ctx.say,
    replayTries: ctx.walk.replay?.tries,
    ...ctx.practise,
  };
  return threadStart(ctx.walk.plan, ctx.at(step)) >= 0 ? Thread(ctx, step, moment, practiseCtx) : null;
}

/** The small line that opens a part: the step's name, as the bar says it.
 *  Other speakers name each of their moments themselves (WalkOthers). */
function partLabel(ctx: ScreenCtx, step: WalkStep): string | null {
  if (step.key === "coachnote") return COPY.titleCoach;
  if (step.key === "summary") return ctx.takeIndex != null ? `${COPY.historyTake} ${ctx.takeIndex}` : COPY.historyTake;
  if (step.key === "others") return null;
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  return moment ? (stepNav(ctx, step, moment).position ?? null) : null;
}

/** The speaker's choice on a step, as their own bubble under it: the same
 *  words the host posts to the Lounge (walkThread.ts, answerBody; the
 *  helper words themselves; the clearer version's choice). Null: a Next or
 *  a Continue, or a try, which is its own bubble. */
function answerSaid(ctx: ScreenCtx, step: WalkStep): string | null {
  const given = ctx.answered(step);
  if (!given) return null;
  if (step.key === "helpers" && given === "use") {
    const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
    const span = moment
      ? selectionSpan(moment.paragraphText, phraseTokens(moment.paragraphText), ctx.picks[pickKey(step)] ?? null)
      : null;
    return span ? stripRichMarkers(span.text) : null;
  }
  if (step.key === "clearer") {
    if (given === "keep") return COPY.linkKeepMyWords;
    if (given === "accept") return step.kind === "accept" ? WALK_COPY.clearerAccept : COPY.pillAcceptPractise;
    return null;
  }
  return answerBody(step, given);
}

/** The thread: each step reached up to `head`, opened by its name when it
 *  changes, with the speaker's choice under it. Only the last part is live.
 *  A new opening (`seq`) draws the parts afresh. */
function renderThread<R>(ctx: ScreenCtx<R>, head: number, seq: number | null, backFromPractise: () => void): ReactNode {
  const parts = walkThreadParts(ctx.walk.plan, head);
  let last: string | null = null;
  return parts.map((part, i) => {
    const step = ctx.walk.plan[part.at];
    const label = partLabel(ctx, step);
    const mark = label && label !== last ? <WalkThreadMark label={label} /> : null;
    last = step.key === "others" ? null : (label ?? last);
    const said = answerSaid(ctx, step);
    return (
      <Fragment key={`${seq ?? 0}:${part.key}`}>
        {mark}
        <WalkPart now={i === parts.length - 1}>{renderScreen(ctx, step, backFromPractise)}</WalkPart>
        {said ? <WalkSpeakerBubble>{said}</WalkSpeakerBubble> : null}
      </Fragment>
    );
  });
}
