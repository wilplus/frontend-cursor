"use client";

import { reasonRuns, type PraiseReason, type WalkPraiseReasons } from "@/lib/willab/praiseReason";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { answerBody, helperWordsSaid } from "@/lib/willab/walkThread";
import CoachVideo from "../CoachVideo";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import { useGuestBlock } from "../GuestSignUpDialog";
import WalkStage from "./WalkStage";
import WalkThread, { WalkEdited, WalkPart, WalkSpeakerBubble, WalkThreadMark, useMountedAsPast } from "./WalkThread";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage, { WalkNewWords } from "./WalkMessage";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkWordPicker from "./WalkWordPicker";
import { practiseThreadFooter, practiseThreadItem, type PractiseScreenCtx } from "./WalkPractiseScreens";
import { useWalkPractise, type WalkPractise } from "./useWalkPractise";
import WalkOthers from "./WalkOthers";
import WalkSummary, { type WalkStoredSummary } from "./WalkSummary";
import WalkTempo from "./WalkTempo";
import { TEMPO_COPY, type TempoEvent, type TempoStretch } from "@/lib/willab/tempoStep";
import WalkAiVoice, { aiTipKnown, aiVoiceComing, aiVoiceShown, type AiVoiceLines } from "./WalkAiVoice";
import { useWalkLines } from "./useWalkLines";
import type { WalkJudgementSave } from "./useWalkJudging";
import type { WalkJournalPost } from "./WalkJudgementScreens";
import { aiClipLines, clearerOpening, topMomentLine, type SayLine, type WalkBankKey, type WalkLinesIO } from "@/lib/willab/walkLines";
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
import { momentEnd, type FeedbackWalkModel, type FeedbackWalkMoment, type WalkMomentEnd } from "@/lib/willab/feedbackWalkModel";
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
/*    others     other speakers' moments to judge, the Take's three (N119)    */
/*    summary    the closing summary, "Take N"; Next closes the walk onto the */
/*               Ideal Text (WalkSummary)                                     */
/*                                                                            */
/*  ‹ › scroll the thread to the step before or after (WalkThread); they      */
/*  never answer and never close. The pill alone moves the journey on, to the */
/*  next step that waits, and the speaker's choice lands as their own bubble. */
/*  A step reopened (the finished walk played again) shows its answer as a    */
/*  "✓ …" line over a black Next. Helper words stay editable on any part: a   */
/*  tap stands the walk there (C3, B10).                                      */
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
 *  move that brought the speaker there (‹ or › across the walk's models).
 *  `head`: the furthest step drawn when the walk goes on past `at` (a Lounge
 *  bubble, the orange words or a paragraph of a walk already answered): the
 *  parts up to it are in the thread to scroll to, `at` is brought to the top
 *  with its own buttons in the dock (founder 2026-10-21: "the WALK opens up
 *  immediately on that part, but you can scroll to previous parts or scroll
 *  to the next ones"; the prototype's "this step is brought to the top"). */
export type FeedbackWalkRequest = { seq: number; at: number; how?: WalkDir; head?: number };

/** The coach's word for the Take, as the walk shows it. */
export type FeedbackWalkCoachNote = {
  text: string | null;
  videoUrl: string | null;
  takeIndex: number | null;
  /** Changed after it was first shared: "Edited" on it (N192, B13). */
  edited?: boolean;
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
  /** The speaker's first name, from the account, for the walk's hello
   *  (founder 2026-10-23, N120); null or absent: the hello without it. */
  firstName?: string | null;
  /** The Take reviewed, for the summary's "Take N". */
  takeIndex?: number | null;
  /** The Take's id: other speakers' moments are the server's set for it
   *  (N119). */
  takeId?: string | null;
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
  /** The summary as the chat holds it, shown at once and in a walk played
   *  again: it lives in the walk only (N192, D4). */
  storedSummary?: WalkStoredSummary | null;
  /** The paragraphs whose helper words were picked again in this Take:
   *  their answer says "Edited" (N192, B13). */
  editedWords?: ReadonlySet<string>;
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
  /** A screen reached the speaker: the host tells the server at once (the
   *  coach's queue, N48.2), before the chat hears what it showed. */
  onReached?: (step: WalkStep, moment: FeedbackWalkMoment<R> | null) => void;
  /** The speaker answered a step (not a replay): the host shows the answer
   *  as their own bubble in the chat, as the thread does. */
  onAnswer?: (step: WalkStep, value: string) => void;
  /** The walk went on past a moment it stood on live (founder 2026-10-21):
   *  the host settles it, so its black line goes and its paragraph opens
   *  the walk as given. ✕, and back from a try, settle nothing. */
  onMomentDone?: (moment: FeedbackWalkMoment<R>, end: WalkMomentEnd) => void;
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
  /** The tempo step's stretch, when the plan has a "tempo" step (backend
   *  N162, N166); absent: the step is passed by. */
  tempo?: TempoStretch | null;
  /** What the tempo step did, for the chat and for Will (N166 step 4). */
  onTempo?: (event: TempoEvent) => void;
};

const NO_EDITS: ReadonlySet<string> = new Set();

/** The AI bubble a screen showed, for the chat. */
export type WalkAiShown = AiVoiceLines & { practiceId: string };

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

/** The steps a practise is opened from; ✕ on the recorder goes back there. */
const OPENERS = new Set(["clearer", "exVideo", "encourage", "late"]);

/** The steps whose dock is the recorder or a try being checked. */
const RECORDER = new Set(["practise", "processing"]);

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
  firstTake,
  firstName = null,
  takeIndex = null,
  takeId = null,
  guest = false,
  onGuest,
  onSaveHelperWords,
  onAcceptClearer,
  onKeepWords,
  practise: practiseIO = null,
  readLimitMs,
  summary = null,
  storedSummary = null,
  editedWords = NO_EDITS,
  onEnd,
  onForward,
  onClose,
  lines: linesIO = null,
  onShown,
  onReached,
  onAnswer,
  onMomentDone,
  onOthers,
  reasons = null,
  othersJudged = 0,
  tempo = null,
  onTempo,
}: Props<R>) {
  const liveModel = useRef(model);
  liveModel.current = model;
  const [walk, setWalk] = useState<FeedbackWalkModel<R>>(model);
  const [at, setAt] = useState(0);
  // The furthest step in the thread: `at`, or further where the walk was
  // opened on a step already answered past (the request's `head`).
  const [reach, setReach] = useState(0);
  const [picks, setPicks] = useState<Record<string, PhraseSelection | null>>({});
  // The answer given to each step in this opening, by the step's identity.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Where the walk stood before a tap on an earlier part's helper words
  // stood it there: their buttons bring it back (C3, B10).
  const [resume, setResume] = useState<number | null>(null);
  const guestBlock = useGuestBlock();

  const requestRef = useRef(request);
  requestRef.current = request;
  const seq = request?.seq ?? null;
  const resetRef = useRef<() => void>(() => undefined);
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    const asked = requestRef.current;
    if (seq === null || !asked) return;
    const opened = liveModel.current;
    resetRef.current();
    setWalk(opened);
    setPicks(replayPicks(opened));
    setAnswers({});
    setResume(null);
    setAt(asked.at);
    setReach(Math.max(asked.at, asked.head ?? asked.at));
    openedAt.current = asked.at;
  }, [seq]);

  const plan = walk.plan;
  const step = plan[at] ?? plan[0];

  // `how` is kept for the callers; the thread does not slide (2026-10-20).
  const go = useCallback((to: number, _how?: WalkDir) => setAt(to), []);
  /** Landing on `to` goes on past the live moment stood on: the host hears
   *  how it ended (founder 2026-10-21). */
  const leftRef = useRef<(steps: readonly WalkStep[], to: number) => void>(() => undefined);
  leftRef.current = (steps, to) => {
    const from = step?.moment;
    if (from == null || step.replay || step.readOnly || steps[to]?.moment === from) return;
    const moment = walk.moments[from];
    if (moment) onMomentDone?.(moment, momentEnd(steps, to, from));
  };
  /** Move to `to` on `steps`; the page underneath ends the walk. A try
   *  played again is never stood on: its recorder and check are passed over
   *  to the answer it got (walk first, 2026-10-14). */
  const land = useCallback(
    (steps: readonly WalkStep[], to: number, how: WalkDir | undefined) => {
      const clamp = (i: number) => Math.max(0, Math.min(i, steps.length - 1));
      let at2 = clamp(to);
      while (steps[at2]?.replay && (steps[at2].key === "practise" || steps[at2].key === "processing")) at2 = clamp(at2 + 1);
      if (how === "forward") leftRef.current(steps, at2);
      go(at2, how);
      setReach((r) => Math.max(r, at2));
      if (steps[at2]?.overlay === false) onEnd();
    },
    [go, onEnd],
  );
  const forward = useCallback(() => {
    if (resume !== null) {
      setResume(null);
      land(plan, resume, undefined);
      return;
    }
    if (onForward?.()) return;
    land(plan, at + 1, "forward");
  }, [at, plan, land, onForward, resume]);
  const atNow = useRef(at);
  atNow.current = at;
  /** Moves on from `step` only while the walk still stands on it: a screen
   *  that finishes by itself may be drawn twice while the stage moves. */
  const forwardFrom = (step: WalkStep) => {
    const here = plan.indexOf(step);
    if (here === atNow.current) land(plan, here + 1, "forward");
    // Finished while the walk stood on earlier helper words: it goes on
    // past it once back.
    else if (here === resume) setResume(here + 1);
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
  const walkLines = useWalkLines(linesIO);
  const { say: sayLine } = walkLines;
  /** The Take's most confident moment's own line in its AI bubble, when the
   *  walk goes on to make that corrected moment better (N109); a praised
   *  moment's practise opens like any other (N122). */
  const ownLine = (s: WalkStep): string | null => {
    const moment = s.moment == null ? undefined : walk.moments[s.moment];
    return s.key === "exVideo" && moment?.highest && !moment.praised ? topMomentLine("example", moment) : null;
  };
  const ai =
    step?.moment != null
      ? aiVoiceShown(plan, at, practise.aiVoiceOf(step.moment), (bank) => sayLine(step, bank), ownLine(step))
      : null;
  const aiPractice = step?.moment != null && ai && ai !== "pending" ? practise.aiVoicePracticeOf(step.moment) : undefined;
  const aiState = step?.moment != null ? practise.aiVoiceOf(step.moment) : undefined;
  const aiKey = ai === "pending" ? "pending" : `${aiState?.demo ?? ""}|${aiState?.clip?.state ?? ""}|${aiPractice ?? ""}|${ai?.line ?? ""}`;
  /** The AI bubble step `s` (at `i`) gives the chat: the one its clip will
   *  make, once one is coming or in, with the practice the chat reads it
   *  from; null: the plain step (founder 2026-10-20: a message is posted
   *  once and never rewritten, so a clip on its way is posted as itself). */
  const chatAi = (s: WalkStep, i: number): WalkAiShown | null => {
    if (s.moment == null) return null;
    const practiceId = practise.aiVoicePracticeOf(s.moment);
    const lines = practiceId
      ? aiVoiceComing(plan, i, practise.aiVoiceOf(s.moment), (bank) => sayLine(s, bank), ownLine(s))
      : null;
    return lines && practiceId ? { ...lines, practiceId } : null;
  };
  /** A voice correction with nothing to offer (founder 2026-10-21, N108):
   *  no exercise served and no AI clip, live once its ask came back without
   *  one, played again when it had no try. Never Line A on its own. The
   *  Take's most confident moment is not one: it says its own line and is
   *  said again (N109). A praised moment's practise with no AI clip is one
   *  too: the praise stands on its own (N122). */
  const bare = (s: WalkStep | undefined, i: number): boolean => {
    const moment = s?.moment == null ? undefined : walk.moments[s.moment];
    if (s?.key !== "exVideo" || s.moment == null || !moment || moment.exercise != null) return false;
    if (moment.highest && !moment.praised) return false;
    if (s.replay || s.readOnly) return s.replay === true && walk.replay?.tries?.[s.moment] === undefined;
    const state = practise.aiVoiceOf(s.moment);
    return state !== undefined && !practise.aiVoiceAsking(s.moment) && aiVoiceShown(plan, i, state) === null;
  };
  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  const reachedRef = useRef(onReached);
  reachedRef.current = onReached;
  // The walk's hello (founder 2026-10-23, N120): drawn once above the walk's
  // first opening, and told to the chat once, before its first step.
  const hello = WALK_COPY.hello(firstName, firstTake);
  const helloSeq = useRef<number | null>(null);
  if (seq !== null && helloSeq.current === null) helloSeq.current = seq;
  const helloTold = useRef(false);
  useEffect(() => {
    if (seq === null || helloTold.current || !step || step.overlay === false) return;
    helloTold.current = true;
    const greet: WalkStep = { key: "hello" };
    shownRef.current?.(greet, null, (bank) => sayLine(greet, bank), null, hello);
    // Once per walk: the words are fixed when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step]);
  useEffect(() => {
    if (seq === null || !step || step.overlay === false) return;
    const moment = step.moment != null ? (walk.moments[step.moment] ?? null) : null;
    // The Exercise is told to the server at once (the coach's queue); its
    // chat bubble waits for whether a clip is coming (below).
    if (step.key === "exVideo") {
      reachedRef.current?.(step, moment);
      return;
    }
    const line =
      step.key === "improved"
        ? improvedLine(plan, at)
        : step.key === "encourage"
          ? encourageLine(plan, at)
          : step.key === "thanks"
            ? thanksLine(plan, at)
            : null;
    // Opened on a moment's helper words (a paragraph that waits, founder
    // 2026-10-20), its praise is just above them: told first, as if the
    // walk had stood on it.
    const above = plan[at - 1];
    if (at === openedAt.current && step.key === "helpers" && above?.key === "praise" && above.moment === step.moment) {
      shownRef.current?.(above, moment, (bank) => sayLine(above, bank), null, null);
    }
    shownRef.current?.(step, moment, (bank) => sayLine(step, bank), chatAi(step, at), line);
    // aiKey changes when the clip's answer lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step, walk.moments, aiKey]);
  // The Exercise's chat bubble (founder 2026-10-20, WIL-89): once the walk
  // knows whether an AI clip is coming (the ask answered, a second or two),
  // even when the speaker already tapped Practise and moved on.
  const toldExercise = useRef(new Set<string>());
  useEffect(() => {
    if (seq === null) return;
    plan.forEach((s, i) => {
      if (i > at || s.key !== "exVideo" || s.moment == null) return;
      const told = `${seq}:${i}`;
      // A bare correction the walk drops, or one played again, is never
      // posted (N108); one already practised past is, as before.
      if (bare(s, i) && (s.replay || i === at)) return;
      // Once its tip is known (N120): the chat says what the bubble says.
      if (toldExercise.current.has(told) || practise.aiVoiceAsking(s.moment) || !aiTipKnown(practise.aiVoiceOf(s.moment))) return;
      toldExercise.current.add(told);
      const moment = walk.moments[s.moment] ?? null;
      shownRef.current?.(s, moment, (bank) => sayLine(s, bank), chatAi(s, i), null);
    });
  });
  // The bare correction leaves the live walk once its ask is answered
  // (N108): it was reached, so the coach's queue heard it; its Exercise and
  // practise go, and the walk stands on what follows them.
  const aiVoiceOf = practise.aiVoiceOf;
  useEffect(() => {
    if (seq === null || !step || step.replay || !bare(step, at)) return;
    const end = loopEnd(plan, at);
    setReach((r) => (r > at ? Math.max(at, r - (end - at)) : r));
    relay([...plan.slice(0, at), ...plan.slice(end)], at, "forward");
    // The ask's answer lands as a new `aiVoiceOf`; `bare` reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step, at, plan, relay, aiVoiceOf, walk.moments]);
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
    bare: (s) => bare(s, plan.indexOf(s)),
    head: at,
    coachNote,
    takeIndex,
    takeId,
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
    standOn: (s) => {
      const here = plan.indexOf(s);
      // The recorder never gives way (B9): moving off it stops the mic.
      if (here < 0 || here === at || s.readOnly || RECORDER.has(step.key)) return false;
      // Back up the thread, their buttons bring the walk back to where it
      // stood; further down, the walk goes on from them.
      setResume((r) => {
        const back = r ?? at;
        return here < back ? back : null;
      });
      go(here);
      return true;
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
    storedSummary,
    editedWords,
    nav: (s, moment) => stepNav(ctx, s, moment),
    say: walkLines.say,
    onOthers,
    othersJudged,
    tempo,
    onTempo,
  };

  // The walk is one chat (founder 2026-10-20): the stage moves only as the
  // lens opens and closes, never between steps; the thread grows inside it.
  // `head` is the furthest part drawn, `at` the one the walk stands on.
  const stage = {
    key: step.overlay === false ? "page" : "walk",
    overlay: step.overlay,
    head: Math.min(Math.max(at, reach), plan.length - 1),
    at,
    seq,
  };
  const frame = useRef<HTMLDivElement | null>(null);

  return (
    <div data-feedback-walk data-walk-step={step.key}>
      {/* The whole window on a wide screen, the words in the Lounge's
          column (globals.css, "The lens on a computer"). */}
      <WalkStage
        screen={stage}
        render={(s, ghost) => (
          <WalkThread ghost={ghost} frame={frame} opening={s.seq} current={s.at} onClose={close}>
            {s.seq !== null && s.seq === helloSeq.current ? <WalkHello text={hello} /> : null}
            {renderThread(ctx, s.head, s.seq, backFromPractise, s.at)}
          </WalkThread>
        )}
      />
    </div>
  );
}

/** The walk's hello, the first bubble of its chat (founder 2026-10-23,
 *  N120). */
function WalkHello({ text }: { text: string }) {
  return (
    <div data-walk-hello className="contents">
      <WalkMessage>
        <span>{text}</span>
      </WalkMessage>
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
  /** A voice correction with nothing to offer (N108): no Line A alone. */
  bare: (step: WalkStep) => boolean;
  /** The newest step reached: the live part of the thread. */
  head: number;
  coachNote: FeedbackWalkCoachNote | null;
  takeIndex: number | null;
  /** The Take the walk is about: other speakers' set for it (N119). */
  takeId: string | null;
  /** The pill: on to the next step that waits. */
  forward: () => void;
  forwardFrom: (step: WalkStep) => void;
  close: () => void;
  picks: Record<string, PhraseSelection | null>;
  answer: (step: WalkStep, value: string) => void;
  answered: (step: WalkStep) => string | null;
  pick: (step: WalkStep, next: PhraseSelection | null) => void;
  /** A tap on the helper words of a part the walk does not stand on: the
   *  walk stands there, their buttons in the dock. False where it may not
   *  (a guest, the recorder in the dock). */
  standOn: (step: WalkStep) => boolean;
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
  storedSummary: WalkStoredSummary | null;
  editedWords: ReadonlySet<string>;
  nav: (step: WalkStep, moment: FeedbackWalkMoment<unknown>) => WalkNav;
  /** The signed line a screen says (D-FW-3). */
  say: SayLine;
  onOthers?: (at: number, of: number, from: string | null, answer: string | null) => void;
  /** Green moments' reasons that arrived after the walk opened. */
  reasons: WalkPraiseReasons | null;
  othersJudged: number;
  tempo: TempoStretch | null;
  onTempo?: (event: TempoEvent) => void;
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
function Answered({ ctx, line }: { ctx: ScreenCtx; line: string | null }) {
  return (
    <WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }}>
      {line ? <p className="m-0 text-center text-[13px] text-muted-foreground">{line}</p> : null}
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

/** On a plan, the moment where this week's level shows most (G7, backend
 *  N134 item 2, N209; the plan's prototype, "This week's level"): its line
 *  above the speaker's clip. */
function LevelHere({ moment }: { moment: FeedbackWalkMoment }) {
  if (!moment.planLevel) return null;
  return (
    <WalkMessage>
      <span data-walk-level>{PLAN_COPY.levelHere(moment.planLevel)}</span>
    </WalkMessage>
  );
}

/** The coach's word for the Take: "Your coach:", their video inside the
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
        <span>{COPY.titleCoachLine}</span>
        {note?.videoUrl ? <CoachVideo src={note.videoUrl} className="my-2 w-full flex-none" /> : null}
        {note?.text ? <span>{note.text}</span> : null}
        {note?.edited ? <WalkEdited /> : null}
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
        {moment.highest ? <span>{COPY.titleMostConfident}</span> : null}
        <span>{moment.praiseTitle ?? COPY.titlePraise}</span>
        {words.length > 0 ? <span>{words.join(" ")}</span> : null}
      </WalkMessage>
      {reason ? <PraiseReasonBubble reason={reason} /> : null}
      <CoachAnswerBubble moment={moment} />
    </WalkOverlay>
  );
}

/** "Choose your helper words": the bubble, then the picker as a big bubble
 *  in the thread. On a part the walk does not stand on, a tap stands the
 *  walk there first, so the words are editable anywhere in the thread (C3,
 *  B10; until 2026-10-28 only the part stood on took a tap, and a walk
 *  opened on its newest step left every earlier picker dead). */
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
            // Words already given: the pill edits them (founder, signed
            // 2026-10-21: "edit the helper words instead of save").
            label: given ? WALK_COPY.editHelperWords : COPY.pillEmphasise,
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
          if (live || ctx.standOn(step)) ctx.pick(step, next);
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
 *  opener (for words that undermined the speaker, B10 and "Try saying it
 *  like this:", N85), the new words and the question, from the signed bank. */
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
          // "✓ Practised" when a practise followed the choice, the one ✓
          // line (founder 2026-10-21); with practice off, Next alone.
          <Answered ctx={ctx} line={practiseOff ? null : WALK_COPY.answeredPractised} />
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
      <LevelHere moment={moment} />
      <Clip moment={moment} words={pieces(clearer.before)} />
      {/* The coach's own clearer version is their bubble, with their photo
          and video, and is not said twice (founder 2026-10-20). */}
      <WalkMessage coach={clearer.byCoach === true} wide={clearer.byCoach === true}>
        {moment.highest ? <span>{topMomentLine("clearer", moment)}</span> : null}
        {clearer.byCoach && moment.coachAnswer?.videoUrl ? (
          <CoachVideo src={moment.coachAnswer.videoUrl} className="my-2 w-full flex-none" />
        ) : null}
        {clearerOpening(clearer.reason, () => ctx.say(step, "B13")).map((line) => (
          <span key={line}>{line}</span>
        ))}
        <WalkNewWords>{pieces(clearer.after)}</WalkNewWords>
        {practiseOff ? null : <span>{ctx.say(step, "B14")}</span>}
      </WalkMessage>
      {clearer.byCoach ? null : <CoachAnswerBubble moment={moment} />}
    </WalkOverlay>
  );
}

/** The Exercise's bubbles: the clip, then the AI clip or the locked Exercise
 *  (with no exercise served, the locked screen with Line A; with no AI clip
 *  coming either, the clip alone as the walk moves past it, N108). */
function ExerciseBody<R>({ ctx, step, moment }: { ctx: ScreenCtx<R>; step: WalkStep; moment: FeedbackWalkMoment<R> }) {
  const exercise = moment.exercise;
  // A praised moment's practise follows its praise (N122): its clip is
  // just above, and it has the AI clip or nothing, never Line A.
  return (
    <>
      {moment.praised ? null : <LevelHere moment={moment} />}
      {moment.praised ? null : <Clip moment={moment} />}
      {aiExercise(ctx, step, moment) ?? (ctx.bare(step) || moment.praised ? null : (
        <WalkMessage coach={exercise?.byCoach === true} wide>
          {moment.highest ? <span>{topMomentLine(exercise?.video ? "example" : "again", moment)}</span> : null}
          {exercise?.video ? (
            <CoachVideo
              src={exercise.video}
              className="my-2 w-full max-h-[300px] flex-none [&>video]:aspect-[4/5] [&>video]:max-h-[300px] [&>video]:object-cover"
            />
          ) : null}
          {/* Line A asks for the confident moment's voice: not on that moment
              itself (founder 2026-10-21). */}
          {exercise?.instruction || !moment.highest ? <span>{exercise?.instruction ?? WALK_COPY.lineA}</span> : null}
        </WalkMessage>
      ))}
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
      <span>{COPY.titleCoachLine}</span>
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
      landing={false}
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
  const say = (bank: WalkBankKey) => ctx.say(step, bank);
  // The Take's most confident moment, corrected: its own line in the
  // opener's place (N109); a praised one's practise opens like any other.
  const own = moment.highest && !moment.praised ? topMomentLine("example", moment) : null;
  const ai = aiVoiceShown(ctx.walk.plan, ctx.at(step), state, say, own);
  if (!ai) return null;
  const lines: AiVoiceLines = ai === "pending" ? aiClipLines(say, state?.clip, false, own) : ai;
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

/** Other speakers' moments: the Take's set, up to three, one per level and
 *  three speakers (founder 2026-10-23, N119; until then one per try). */
function Others(ctx: ScreenCtx, step: WalkStep) {
  return (
    <WalkOthers
      testId={testId(step)}
      take={ctx.takeId}
      judged={ctx.othersJudged}
      skip={Boolean(step.readOnly || step.replay)}
      onDone={() => ctx.forwardFrom(step)}
      onClose={ctx.close}
      onChat={ctx.onOthers}
    />
  );
}

/** The tempo step (backend N162, N166): the stretch practised on the pace
 *  scale. With no stretch it is passed by. */
function Tempo(ctx: ScreenCtx, step: WalkStep) {
  if (!ctx.tempo || step.readOnly || step.replay) return <PassBy onPass={() => ctx.forwardFrom(step)} />;
  return (
    <WalkTempo
      testId={testId(step)}
      stretch={ctx.tempo}
      onDone={() => ctx.forwardFrom(step)}
      onClose={ctx.close}
      onEvent={ctx.onTempo}
    />
  );
}

/** A step with nothing to show moves the walk on once drawn. */
function PassBy({ onPass }: { onPass: () => void }) {
  const past = useMountedAsPast();
  const pass = useRef(onPass);
  pass.current = onPass;
  useEffect(() => {
    if (!past) pass.current();
  }, [past]);
  return null;
}

/** The closing summary, the last lens step. */
function Summary(ctx: ScreenCtx, step: WalkStep) {
  return (
    <WalkSummary
      testId={testId(step)}
      takeIndex={ctx.takeIndex}
      fetchText={ctx.summary}
      stored={ctx.storedSummary}
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
  if (step.key === "tempo") return Tempo(ctx, step);
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
  if (step.key === "tempo") return TEMPO_COPY.mark;
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  return moment ? (stepNav(ctx, step, moment).position ?? null) : null;
}

/** Helper words picked again in this Take: their answer, in place, says
 *  "Edited" (N192, B13; no second bubble, no struck-through words). */
function wordsEdited(ctx: ScreenCtx, step: WalkStep): boolean {
  if (step.key !== "helpers" || step.moment == null) return false;
  const moment = ctx.walk.moments[step.moment];
  return moment ? ctx.editedWords.has(moment.partId) : false;
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
    return span ? helperWordsSaid(stripRichMarkers(span.text)) : null;
  }
  if (step.key === "clearer") {
    if (given === "keep") return COPY.linkKeepMyWords;
    if (given === "accept") return step.kind === "accept" ? WALK_COPY.clearerAccept : COPY.pillAcceptPractise;
    return null;
  }
  return answerBody(step, given);
}

/** The thread: each step reached up to `head`, opened by its name when it
 *  changes, with the speaker's choice under it. The part holding `at`, the
 *  step the walk stands on, is marked: its buttons are the dock and
 *  WalkThread brings it to the top; the parts before and after it are there
 *  to scroll (founder 2026-10-21). The last part is the newest: first drawn
 *  as the step the walk stands on, its bubbles land one by one. A new
 *  opening (`seq`) draws the parts afresh. */
function renderThread<R>(
  ctx: ScreenCtx<R>,
  head: number,
  seq: number | null,
  backFromPractise: () => void,
  at: number,
): ReactNode {
  const parts = walkThreadParts(ctx.walk.plan, head);
  const standing = parts.findIndex((p) => p.at >= at);
  const now = standing >= 0 ? standing : parts.length - 1;
  let last: string | null = null;
  return parts.map((part, i) => {
    const step = ctx.walk.plan[part.at];
    const label = partLabel(ctx, step);
    const mark = label && label !== last ? <WalkThreadMark label={label} /> : null;
    last = step.key === "others" ? null : (label ?? last);
    const said = answerSaid(ctx, step);
    const body = (
      <>
        {mark}
        <WalkPart now={i === now} fresh={i === parts.length - 1}>
          {renderScreen(ctx, step, backFromPractise)}
        </WalkPart>
        {said ? <WalkSpeakerBubble edited={wordsEdited(ctx, step)}>{said}</WalkSpeakerBubble> : null}
      </>
    );
    return (
      <Fragment key={`${seq ?? 0}:${part.key}`}>
        {i === now ? (
          <div data-walk-now className="contents">
            {body}
          </div>
        ) : (
          body
        )}
      </Fragment>
    );
  });
}
