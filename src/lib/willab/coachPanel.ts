/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn — the pure half of P1 (founder lock 2026-10-06,   */
/*  FOUNDER-LOCK-coach-panel-redesign-2026-10-06, flow steps 1 to 5).          */
/*                                                                            */
/*    lounge → Your queue → a speaker → Judge this moment → What happened     */
/*    lounge → Your speakers (the pinned button) → a speaker → …              */
/*    lounge → Training corpus (the pinned button) → Import audio / Finish    */
/*             the set-up → Analysing → Judge this moment (D-CP-20)           */
/*                                                                            */
/*  One reducer, no fetch, no React, so every rule is a unit test:             */
/*    - ‹ goes back through a history stack, as the prototype's back();      */
/*      the queue is the first screen and has no ‹;                           */
/*    - the counter counts moments only ("moment 1 of 4");                    */
/*    - ‹ › onto a moment this coach has not rated lands on Judge, onto a     */
/*      rated one on What happened;                                           */
/*    - Judge moves on to What happened by itself once the rating is saved.  */
/*                                                                            */
/*  BLIND COACH: What happened is reachable ONLY for a rated moment. A ‹ that */
/*  would land on the Judge screen of a moment already rated lands on its     */
/*  What happened instead: once the coach has seen the passage and the        */
/*  machine's read, the blind answer cannot be given again.                   */
/* -------------------------------------------------------------------------- */

import {
  afterJudged,
  nextOpenIndex,
  replaceMoment,
  type AnswerValue,
  type QueueMoment,
  type QueueSpeaker,
  type QueueTake,
} from "./coachWalk";
import type { WalkDir, WalkScreen } from "./walkMotion";

export type MomentScreen = {
  key: "judge" | "reveal";
  speaker: QueueSpeaker;
  take: QueueTake;
  /** Which moment of the take, 0-based. */
  index: number;
};

export type PanelScreen =
  | { key: "lounge" }
  | { key: "queue" }
  /** Your speakers: every speaker, from the pinned button (D-CP-12). */
  | { key: "speakers" }
  | { key: "speaker"; speaker: QueueSpeaker }
  /** The training corpus (CO1 A): the imports, the set-up (of a new file,
   *  or of an import whose set-up is not finished), the loader, the blind
   *  judging of one import's moments. */
  | { key: "corpushome" }
  | { key: "corpusimport"; setupOf: string | null }
  | { key: "corpusanalyse" }
  | { key: "corpus"; importId: string; topic: string }
  | MomentScreen;

export type PanelState = {
  screen: PanelScreen;
  history: PanelScreen[];
  /** The direction of the step that produced `screen` (for the motion). */
  dir?: WalkDir;
  /** The ratings this coach saved on this visit, by snippet. */
  rated: Record<string, AnswerValue>;
};

export type PanelAction =
  | { type: "open" }
  | { type: "speakers" }
  | { type: "corpus" }
  | { type: "corpusImport"; setupOf?: string | null }
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
  /** Back from the old answer flow (P1's hand-over): the moment after
   *  `index` that is still open, or the speaker's Takes when none is. */
  | { type: "resume"; speaker: QueueSpeaker; take: QueueTake; index: number };

export const PANEL_START: PanelState = { screen: { key: "lounge" }, history: [], rated: {} };

/** Has this coach rated the moment (before this visit, or on it)? */
export function isRated(moment: QueueMoment | undefined, rated: Record<string, AnswerValue>): boolean {
  if (!moment) return false;
  return moment.state !== "judge_it" || rated[moment.snippetId] !== undefined;
}

/** Where a moment opens: Judge until rated, then What happened. */
export function landing(
  speaker: QueueSpeaker,
  take: QueueTake,
  index: number,
  rated: Record<string, AnswerValue>,
): MomentScreen {
  const key = isRated(take.moments[index], rated) ? "reveal" : "judge";
  return { key, speaker, take, index };
}

/** The moment a screen is about, if any. */
export function momentOf(screen: PanelScreen): QueueMoment | null {
  if (screen.key !== "judge" && screen.key !== "reveal") return null;
  return screen.take.moments[screen.index] ?? null;
}

/** The take with this visit's ratings applied (a rated "Judge it" reads
 *  "Judged"), as the old flow expects it. */
export function takeWithRatings(take: QueueTake, rated: Record<string, AnswerValue>): QueueTake {
  let moments = take.moments;
  for (const m of take.moments) {
    if (rated[m.snippetId] !== undefined) moments = replaceMoment(moments, afterJudged(m));
  }
  return moments === take.moments ? take : { ...take, moments };
}

function sameScreen(a: PanelScreen, b: PanelScreen): boolean {
  if (a.key !== b.key) return false;
  if (a.key === "speaker" && b.key === "speaker") return a.speaker.pseudonym === b.speaker.pseudonym;
  if (a.key === "corpusimport" && b.key === "corpusimport") return a.setupOf === b.setupOf;
  if (a.key === "corpus" && b.key === "corpus") return a.importId === b.importId;
  const ma = momentOf(a);
  const mb = momentOf(b);
  return ma?.snippetId === mb?.snippetId;
}

function push(state: PanelState, screen: PanelScreen, dir: WalkDir = "forward"): PanelState {
  return { ...state, screen, dir, history: [...state.history, state.screen] };
}

/** A screen as it is now: a Judge screen of a rated moment is its What
 *  happened (BLIND COACH). */
function settle(screen: PanelScreen, rated: Record<string, AnswerValue>): PanelScreen {
  if (screen.key !== "judge") return screen;
  return landing(screen.speaker, screen.take, screen.index, rated);
}

function back(state: PanelState): PanelState {
  const history = [...state.history];
  while (history.length > 0) {
    const previous = settle(history.pop() as PanelScreen, state.rated);
    if (sameScreen(previous, state.screen)) continue;
    return { ...state, screen: previous, history, dir: "back" };
  }
  return { ...state, screen: { key: "lounge" }, history: [], dir: undefined };
}

function step(state: PanelState): PanelState {
  const { screen } = state;
  if (screen.key !== "judge" && screen.key !== "reveal") return state;
  const total = screen.take.moments.length;
  if (total < 2) return state;
  const index = (screen.index + 1) % total;
  return push(state, landing(screen.speaker, screen.take, index, state.rated));
}

function rated(state: PanelState, snippetId: string, value: AnswerValue): PanelState {
  const next = { ...state, rated: { ...state.rated, [snippetId]: value } };
  const { screen } = state;
  if (screen.key !== "judge" || momentOf(screen)?.snippetId !== snippetId) return next;
  return push(next, { ...screen, key: "reveal" });
}

function openTake(state: PanelState, speaker: QueueSpeaker, take: QueueTake): PanelState {
  if (take.moments.length === 0) return state;
  const first = nextOpenIndex(take.moments, null);
  return push(state, landing(speaker, take, first === -1 ? 0 : first, state.rated));
}

function resume(state: PanelState, speaker: QueueSpeaker, take: QueueTake, index: number): PanelState {
  const history: PanelScreen[] = [state.history[0]?.key === "speakers" ? { key: "speakers" } : { key: "queue" }, { key: "speaker", speaker }];
  const later = nextOpenIndex(take.moments, index);
  const after = later !== -1 ? later : nextOpenIndex(take.moments, null);
  if (after === -1) return { ...state, screen: history[1], history: [history[0]], dir: "forward" };
  return { ...state, screen: landing(speaker, take, after, state.rated), history, dir: "forward" };
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "open":
      return { ...state, screen: { key: "queue" }, history: [], dir: undefined };
    case "speakers":
      return { ...state, screen: { key: "speakers" }, history: [], dir: undefined };
    case "corpus":
      return { ...state, screen: { key: "corpushome" }, history: [], dir: undefined };
    case "corpusImport":
      return push(state, { key: "corpusimport", setupOf: action.setupOf ?? null });
    case "corpusAnalyse":
      return push(state, { key: "corpusanalyse" });
    case "corpusJudge":
      return push(state, { key: "corpus", importId: action.importId, topic: action.topic });
    case "corpusSetUp":
      return { ...state, screen: { key: "corpus", importId: action.importId, topic: action.topic }, history: [], dir: "fade" };
    case "corpusHome":
      return { ...state, screen: { key: "corpushome" }, history: [], dir: "back" };
    case "close":
      return { ...state, screen: { key: "lounge" }, history: [], dir: undefined };
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
    case "resume":
      return resume(state, action.speaker, action.take, action.index);
    default:
      return state;
  }
}

/** The moment bar's numbers: which moment of how many. Moments only. */
export function momentCounter(screen: PanelScreen): { index: number; total: number } | null {
  if (screen.key !== "judge" && screen.key !== "reveal") return null;
  return { index: screen.index, total: screen.take.moments.length };
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
  return { key: screen.key, moment: screen.index, kind: screen.take.sessionId };
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
