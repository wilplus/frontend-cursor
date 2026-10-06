/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn — every word P1 puts on screen (founder lock      */
/*  2026-10-06, FOUNDER-LOCK-coach-panel-redesign-2026-10-06; build plan P0).  */
/*                                                                            */
/*  ONLY SIGNED WORDS. A string here is one of three things, and nothing else: */
/*    (a) a word the founder signed for this panel (the lock's "Words signed   */
/*        (CP2 A)" list), typed exactly as listed;                            */
/*    (b) a word the app already says to coaches, IMPORTED from its copy      */
/*        module, never retyped;                                              */
/*    (c) the two pinned buttons the lock's flow names in step 1 (Speakers,   */
/*        Training corpus).                                                   */
/*  coachPanelCopy.test.ts holds the signed list and fails on anything else.  */
/*                                                                            */
/*  No number about a speaker's quality: the only numbers are counts of       */
/*  moments waiting (as today's queue shows) and a Take's or a moment's       */
/*  position (AC-9).                                                          */
/* -------------------------------------------------------------------------- */

import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import { COACH_WALK_COPY as WALK } from "./coachWalkCopy";

/** (b) Words the app already says, imported. */
const REUSED = {
  queueTitle: WALK.queueTitle,
  queueEmpty: WALK.queueEmpty,
  bubbleWaiting: WALK.bubbleWaiting,
  bubbleOpen: WALK.bubbleOpen,
  waitingForText: WALK.queueWaitingForText,
  /** The blind lines' count (6a, 8); their titles are the backend's own. */
  blindWaiting: WALK.queueBlindWaiting,
  judgeTitle: WALK.judgeTitle,
  judgeQuestion: WALK.judgeQuestion,
  judgeFail: WALK.judgeFail,
  toastJudged: WALK.toastJudged,
  /** The five answers as words after the fact (Confident, In-between, …). */
  answer: WALK.answer,
  you: WALK.readYou,
  readFail: WALK.readFail,
  next: WALK.pillNext,
  /** "Take N", the signed coach-card words (L6). */
  take: (takeIndex: number | null) =>
    takeIndex ? `${CHUNK_SHEET_COPY.historyTake} ${takeIndex}` : CHUNK_SHEET_COPY.historyTake,
} as const;

/** (a) Signed by the founder (CP2 A), exactly as listed. A count of one
 *  reads in the singular, as the prototype draws it ("1 moment waiting"). */
const SIGNED = {
  yourSpeakers: "Your speakers",
  momentsWaiting: (n: number) => (n === 1 ? "1 moment waiting" : `${n} moments waiting`),
  takeWaiting: (n: number, m: number) => `${n} of ${m} moments waiting`,
  allMomentsAnswered: "All moments answered",
  answered: "Answered",
  answeredMoments: (n: number) => (n === 1 ? "Answered · 1 moment" : `Answered · ${n} moments`),
  whatHappened: "What happened",
  machineHeard: "The machine heard",
} as const;

/** (c) The pinned buttons, as the lock's flow names them. */
const NAMED = {
  speakers: "Speakers",
  trainingCorpus: "Training corpus",
} as const;

export const COACH_PANEL_COPY = { ...REUSED, ...SIGNED, ...NAMED } as const;

/** Which keys came from where, for the test. */
export const COACH_PANEL_COPY_SOURCES = {
  reused: Object.keys(REUSED),
  signed: Object.keys(SIGNED),
  named: Object.keys(NAMED),
} as const;
