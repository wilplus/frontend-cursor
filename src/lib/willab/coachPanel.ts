/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn — the pure half (founder lock 2026-10-06,         */
/*  FOUNDER-LOCK-coach-panel-redesign-2026-10-06, flow steps 1 to 13).        */
/*                                                                            */
/*    lounge → Your queue → a speaker → Judge this moment → What happened     */
/*      → (an error) What kind of error is it? / Name the error               */
/*      → Choose exercise / What will you do? → Swap it → Details             */
/*      → Your words → Your video → the kind question → Ready for {p}         */
/*      → the next open moment, or A word for this Take → its video           */
/*    an answered moment opens on Summary; Change my answer reopens it        */
/*    lounge → Your speakers (the pinned button) → a speaker → …              */
/*    lounge → Training corpus (the pinned button) → Import audio / Finish    */
/*             the set-up → Analysing → Judge this moment (D-CP-20)           */
/*                                                                            */
/*  One reducer, no fetch, no React, so every rule is a unit test:             */
/*    - ‹ goes back through a history stack, as the prototype's back();      */
/*      the queue is the first screen and has no ‹; ‹ into a step of another  */
/*      moment already answered reopens that moment's choice (prototype);    */
/*    - the counter counts moments only ("moment 1 of 4");                    */
/*    - a moment this coach has not rated lands on Judge, an answered one on  */
/*      Summary, any other rated one on What happened;                        */
/*    - Judge moves on to What happened by itself as the rating is tapped,   */
/*      with the save in flight (C1, founder 2026-10-08); a failed save     */
/*      un-rates the moment and goes back to its Judge screen.               */
/*                                                                            */
/*  BLIND COACH: no screen after Judge is reachable for an unrated moment. A  */
/*  ‹ that would land on the Judge screen of a moment already rated lands on  */
/*  What happened (or Summary) instead: once the coach has seen the passage   */
/*  and the machine's read, the blind answer cannot be given again.           */
/* -------------------------------------------------------------------------- */

import {
  isOpen,
  type AnswerValue,
  type QueueMoment,
  type QueueSpeaker,
  type QueueTake,
} from "./coachWalk";
import type { WalkDir, WalkScreen } from "./walkMotion";

/** Every screen about one moment, in the lock's order. */
export type MomentKey =
  | "judge" | "reveal" | "diagnose" | "nameerr" | "decide" | "swap" | "exdetail"
  | "words" | "video" | "kind" | "share" | "summary";

const MOMENT_KEYS: ReadonlySet<string> = new Set<MomentKey>([
  "judge", "reveal", "diagnose", "nameerr", "decide", "swap", "exdetail",
  "words", "video", "kind", "share", "summary",
]);

/** The steps of an answer: a ‹ into one of these, on a moment answered
 *  since, reopens that moment's choice instead (prototype back()). */
const ANSWER_STEPS: ReadonlySet<string> = new Set<MomentKey>([
  "diagnose", "nameerr", "decide", "swap", "exdetail", "words", "video", "kind", "share",
]);

export type MomentScreen = {
  key: MomentKey;
  speaker: QueueSpeaker;
  take: QueueTake;
  /** Which moment of the take, 0-based. */
  index: number;
  /** Details: the exercise shown. */
  exerciseId?: string;
};

/** A word for this Take, and its video (flow step 13). */
export type TakeScreen = { key: "takeword" | "takevideo"; speaker: QueueSpeaker; take: QueueTake };

export type PanelScreen =
  | { key: "lounge" }
  | { key: "queue" }
  /** Your speakers: every speaker, from the pinned button (D-CP-12). */
  | { key: "speakers" }
  | { key: "speaker"; speaker: QueueSpeaker }
  /** The training corpus (CO1 A): the imports, the set-up (of a new file,
   *  of an import whose set-up is not finished, or an edit of a finished
   *  one from its ⋯), the loader, the blind judging of one import's moments. */
  | { key: "corpushome" }
  | { key: "corpusimport"; setupOf: string | null; edit?: boolean }
  | { key: "corpusanalyse" }
  | { key: "corpus"; importId: string; topic: string }
  | MomentScreen
  | TakeScreen;

/** Where this visit has left a moment: answered ("done"), reopened by Change
 *  my answer ("open"), or passed with nothing to answer ("passed"). */
export type MomentMark = "done" | "open" | "passed";

export type PanelState = {
  screen: PanelScreen;
  history: PanelScreen[];
  /** The direction of the step that produced `screen` (for the motion). */
  dir?: WalkDir;
  /** The ratings this coach saved on this visit, by snippet. */
  rated: Record<string, AnswerValue>;
  /** This visit's answers, by snippet; the queue's state otherwise. */
  marks: Record<string, MomentMark>;
};

export type PanelAction =
  | { type: "open" }
  | { type: "speakers" }
  | { type: "corpus" }
  | { type: "corpusImport"; setupOf?: string | null; edit?: boolean }
  | { type: "corpusAnalyse" }
  | { type: "corpusJudge"; importId: string; topic: string }
  /** A set-up just saved: straight to its judging, as the prototype's
   *  doImport does (history cleared, a soft cross-fade). */
  | { type: "corpusSetUp"; importId: string; topic: string }
  /** Back to the imports after an import or a judged moment set (the
   *  prototype goes "back" there with nothing behind). */
  | { type: "corpusHome" }
  | { type: "close" }
  | { type: "speaker"; speaker: QueueSpeaker }
  | { type: "take"; speaker: QueueSpeaker; take: QueueTake }
  | { type: "next" }
  | { type: "back" }
  | { type: "rated"; snippetId: string; value: AnswerValue }
  /** The rating's save failed (C1): the moment is not rated after all, and
   *  its What happened, if on screen, goes back to its Judge screen. */
  | { type: "unrated"; snippetId: string }
  /** The next screen of the moment on screen. */
  | { type: "step"; key: MomentKey; exerciseId?: string }
  /** The moment on screen is answered: on to the next open one. */
  | { type: "finish" }
  /** Nothing reached the coach from this moment: on, nothing written. */
  | { type: "pass" }
  /** Summary's Next: on to the next open moment, or the Take's word. */
  | { type: "onward" }
  /** Change my answer: the moment opens again at its choice. */
  | { type: "changeAnswer"; to: "decide" | "diagnose" }
  /** A word for this Take: on to its video. */
  | { type: "takeVideo" };

export const PANEL_START: PanelState = { screen: { key: "lounge" }, history: [], rated: {}, marks: {} };

/** Has this coach rated the moment (before this visit, or on it)? */
export function isRated(moment: QueueMoment | undefined, rated: Record<string, AnswerValue>): boolean {
  if (!moment) return false;
  return moment.state !== "judge_it" || rated[moment.snippetId] !== undefined;
}

/** Is the moment answered (on this visit, or before it)? */
export function isAnswered(moment: QueueMoment | undefined, marks: Record<string, MomentMark>): boolean {
  if (!moment) return false;
  const mark = marks[moment.snippetId];
  if (mark) return mark === "done";
  return moment.state === "answered" || moment.state === "nothing_to_add";
}

/** Does the moment still wait on this coach? */
function waits(moment: QueueMoment, marks: Record<string, MomentMark>): boolean {
  const mark = marks[moment.snippetId];
  return mark ? mark === "open" : isOpen(moment.state);
}

/** Where a moment opens: Judge until rated, Summary once answered, What
 *  happened in between. */
export function landing(speaker: QueueSpeaker, take: QueueTake, index: number, state: Pick<PanelState, "rated" | "marks">): MomentScreen {
  const moment = take.moments[index];
  const key: MomentKey = !isRated(moment, state.rated) ? "judge"
    : isAnswered(moment, state.marks) ? "summary" : "reveal";
  return { key, speaker, take, index };
}

export function isMomentScreen(screen: PanelScreen): screen is MomentScreen {
  return MOMENT_KEYS.has(screen.key);
}

/** The moment a screen is about, if any. */
export function momentOf(screen: PanelScreen): QueueMoment | null {
  if (!isMomentScreen(screen)) return null;
  return screen.take.moments[screen.index] ?? null;
}

function sameScreen(a: PanelScreen, b: PanelScreen): boolean {
  if (a.key !== b.key) return false;
  if (a.key === "speaker" && b.key === "speaker") return a.speaker.pseudonym === b.speaker.pseudonym;
  if (a.key === "corpusimport" && b.key === "corpusimport") return a.setupOf === b.setupOf;
  if (a.key === "corpus" && b.key === "corpus") return a.importId === b.importId;
  if ((a.key === "takeword" || a.key === "takevideo") && "take" in a && "take" in b) return a.take.sessionId === b.take.sessionId;
  const ma = momentOf(a);
  const mb = momentOf(b);
  return ma?.snippetId === mb?.snippetId;
}

function push(state: PanelState, screen: PanelScreen, dir: WalkDir = "forward"): PanelState {
  return { ...state, screen, dir, history: [...state.history, state.screen] };
}

/** A screen as it is now: a Judge, What happened or Summary screen is where
 *  its moment lands today (BLIND COACH; C1), and no step after Judge stands
 *  for a moment that is not rated. */
function settle(screen: PanelScreen, state: PanelState): PanelScreen {
  if (!isMomentScreen(screen)) return screen;
  const fixed = screen.key === "judge" || screen.key === "reveal" || screen.key === "summary";
  if (fixed || !isRated(momentOf(screen) ?? undefined, state.rated)) {
    return landing(screen.speaker, screen.take, screen.index, state);
  }
  return screen;
}

function back(state: PanelState): PanelState {
  const history = [...state.history];
  const here = momentOf(state.screen)?.snippetId;
  while (history.length > 0) {
    const previous = settle(history.pop() as PanelScreen, state);
    if (sameScreen(previous, state.screen)) continue;
    const moment = momentOf(previous);
    if (moment && moment.snippetId !== here && ANSWER_STEPS.has(previous.key) && isAnswered(moment, state.marks)) {
      // Back into a moment answered since: its choice, to change it.
      const marks = { ...state.marks, [moment.snippetId]: "open" as const };
      return { ...state, marks, screen: { ...(previous as MomentScreen), key: "decide" }, history, dir: "back" };
    }
    return { ...state, screen: previous, history, dir: "back" };
  }
  return { ...state, screen: { key: "lounge" }, history: [], dir: undefined };
}

function step(state: PanelState): PanelState {
  const { screen } = state;
  if (!isMomentScreen(screen)) return state;
  const total = screen.take.moments.length;
  if (total < 2) return state;
  const index = (screen.index + 1) % total;
  return push(state, landing(screen.speaker, screen.take, index, state));
}

function rated(state: PanelState, snippetId: string, value: AnswerValue): PanelState {
  const next = { ...state, rated: { ...state.rated, [snippetId]: value } };
  const { screen } = state;
  if (screen.key !== "judge" || momentOf(screen)?.snippetId !== snippetId) return next;
  return push(next, { ...screen, key: "reveal" });
}

function unrated(state: PanelState, snippetId: string): PanelState {
  if (state.rated[snippetId] === undefined) return state;
  const { [snippetId]: _failed, ...rest } = state.rated;
  const next = { ...state, rated: rest };
  const { screen } = state;
  if (screen.key !== "reveal" || momentOf(screen)?.snippetId !== snippetId) return next;
  return back(next);
}

/** The next moment that still waits, after `from` and round the take, or -1. */
export function nextWaiting(moments: readonly QueueMoment[], from: number, marks: Record<string, MomentMark>): number {
  for (let j = 1; j <= moments.length; j += 1) {
    const k = (from + j) % moments.length;
    if (k !== from && waits(moments[k], marks)) return k;
  }
  return -1;
}

function openTake(state: PanelState, speaker: QueueSpeaker, take: QueueTake): PanelState {
  if (take.moments.length === 0) return state;
  const first = take.moments.findIndex((m) => waits(m, state.marks));
  return push(state, landing(speaker, take, first === -1 ? 0 : first, state));
}

/** On from the moment on screen: the next one that waits, or the Take's
 *  word when none does (prototype finishMoment / fromSummary). */
function onward(state: PanelState, mark?: MomentMark): PanelState {
  const { screen } = state;
  if (!isMomentScreen(screen)) return state;
  const id = momentOf(screen)?.snippetId;
  const next = mark && id ? { ...state, marks: { ...state.marks, [id]: mark } } : state;
  const k = nextWaiting(screen.take.moments, screen.index, next.marks);
  if (k === -1) return push(next, { key: "takeword", speaker: screen.speaker, take: screen.take });
  return push(next, landing(screen.speaker, screen.take, k, next));
}

function toStep(state: PanelState, key: MomentKey, exerciseId?: string): PanelState {
  const { screen } = state;
  if (!isMomentScreen(screen) || !isRated(momentOf(screen) ?? undefined, state.rated)) return state;
  return push(state, { ...screen, key, exerciseId });
}

function changeAnswer(state: PanelState, to: "decide" | "diagnose"): PanelState {
  const { screen } = state;
  const id = momentOf(screen)?.snippetId;
  if (!id || !isMomentScreen(screen)) return state;
  const next = { ...state, marks: { ...state.marks, [id]: "open" as const } };
  return push(next, { ...screen, key: to }, "back");
}

function fresh(state: PanelState, screen: PanelScreen, dir?: WalkDir): PanelState {
  return { ...state, screen, history: [], dir };
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "open":
      return fresh(state, { key: "queue" });
    case "speakers":
      return fresh(state, { key: "speakers" });
    case "corpus":
      return fresh(state, { key: "corpushome" });
    case "corpusImport":
      return push(state, { key: "corpusimport", setupOf: action.setupOf ?? null, edit: action.edit });
    case "corpusAnalyse":
      return push(state, { key: "corpusanalyse" });
    case "corpusJudge":
      return push(state, { key: "corpus", importId: action.importId, topic: action.topic });
    case "corpusSetUp":
      return fresh(state, { key: "corpus", importId: action.importId, topic: action.topic }, "fade");
    case "corpusHome":
      return fresh(state, { key: "corpushome" }, "back");
    case "close":
      return fresh(state, { key: "lounge" });
    case "speaker":
      return push(state, { key: "speaker", speaker: action.speaker });
    case "take":
      return openTake(state, action.speaker, action.take);
    case "next":
      return step(state);
    case "back":
      return back(state);
    case "rated":
      return rated(state, action.snippetId, action.value);
    case "unrated":
      return unrated(state, action.snippetId);
    case "step":
      return toStep(state, action.key, action.exerciseId);
    case "finish":
      return onward(state, "done");
    case "pass":
      return onward(state, "passed");
    case "onward":
      return onward(state);
    case "changeAnswer":
      return changeAnswer(state, action.to);
    case "takeVideo":
      return state.screen.key === "takeword" ? push(state, { ...state.screen, key: "takevideo" }) : state;
    default:
      return state;
  }
}

/** The screen as the walk's motion sees it. */
export function walkScreenOf(screen: PanelScreen): WalkScreen {
  if (screen.key === "lounge") return { key: "lounge", overlay: false };
  if (screen.key === "queue") return { key: "queue" };
  if (screen.key === "speakers") return { key: "speakers" };
  if (screen.key === "corpushome" || screen.key === "corpusanalyse") return { key: screen.key };
  if (screen.key === "corpusimport") return { key: "corpusimport", kind: screen.setupOf ?? "new" };
  if (screen.key === "corpus") return { key: "corpus", kind: screen.importId };
  if (screen.key === "speaker") return { key: "speaker", kind: screen.speaker.pseudonym };
  if (!isMomentScreen(screen)) return { key: screen.key, kind: screen.take.sessionId };
  return { key: screen.key, moment: screen.index, kind: `${screen.take.sessionId}${screen.exerciseId ? `:${screen.exerciseId}` : ""}` };
}

/** The next piece of an import the coach has not labelled, after `at`, in
 *  payload order (never re-sorted: the order is the server's, N2), or -1
 *  when none is left ahead. Pure. */
export function nextUnlabelledIndex(labelled: readonly boolean[], at: number): number {
  for (let i = at + 1; i < labelled.length; i += 1) if (!labelled[i]) return i;
  return -1;
}

/** Where an import's judging opens: its first unlabelled piece, or the first. */
export function firstUnlabelledIndex(labelled: readonly boolean[]): number {
  const i = labelled.findIndex((done) => !done);
  return i >= 0 ? i : 0;
}
