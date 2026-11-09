"use client";

import { reasonRuns, type PraiseReason, type WalkPraiseReasons } from "@/lib/willab/praiseReason";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { answerBody, helperWordsSaid, skipReply, withoutOpeningFillers, type OthersLevel, type WalkTempoLine } from "@/lib/willab/walkThread";
import CoachVideo from "../CoachVideo";
import { CHUNK_SHEET_COPY as COPY, ONE_THING_COPY, WALK_COPY } from "../idealEditCopy";
import { useGuestBlock } from "../GuestSignUpDialog";
import WalkStage from "./WalkStage";
import WalkThread, { WalkEdited, WalkLanding, WalkPart, WalkSpeakerBubble, WalkThreadMark, WalkTyping, useMountedAsPast, useWalkHeld, useWalkPart } from "./WalkThread";
import { useBestSaid, type WalkVoiceSaid } from "./useWalkVoice";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage, { WalkNewWords } from "./WalkMessage";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkWordPicker from "./WalkWordPicker";
import { practiseThreadFooter, practiseThreadItem, type PractiseScreenCtx } from "./WalkPractiseScreens";
import { useWalkQuote, type WalkQuoteIO, type WalkQuotes } from "./useWalkQuote";
import { useWalkPractise, type WalkPractise } from "./useWalkPractise";
import WalkOthers from "./WalkOthers";
import WalkSummary, { type WalkStoredSummary } from "./WalkSummary";
import WalkTempo from "./WalkTempo";
import WalkTempoSaid from "./WalkTempoSaid";
import WalkLoading from "./WalkLoading";
import { TEMPO_COPY, type TempoEvent, type TempoStretch } from "@/lib/willab/tempoStep";
import WalkAiVoice, { aiTipKnown, aiVoiceComing, aiVoiceShown, AI_CLIP_WAIT_MS, clipWaitedOut, useClipBeforeTry, useClipWait, useLandsOnce, type AiVoiceLines } from "./WalkAiVoice";
import { useWalkLines } from "./useWalkLines";
import type { WalkJudgementSave } from "./useWalkJudging";
import type { WalkJournalPost } from "./WalkJudgementScreens";
import { MOMENT_LEAD_LINES, aiClipLines, aiTip, bestBubble, clearerOpening, oneThingAiLines, oneThingNoClip, praiseBubble, topMomentLine, type SayLine, type WalkBankKey, type WalkLinesIO, phrasePieces } from "@/lib/willab/walkLines";
import { walkSig, type WalkDir } from "@/lib/willab/walkMotion";
import { goodJobHelpers, maxTries, momentLead, type WalkStep } from "@/lib/willab/walkPlan";
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
import { momentEnd, type FeedbackWalkModel, type FeedbackWalkMoment, type WalkClip, type WalkMomentEnd } from "@/lib/willab/feedbackWalkModel";
import type { ClearerPiece } from "@/lib/willab/clearerPieces";
import { phraseTokens, quoteSpan, selectionSpan, type PhraseSelection } from "@/lib/willab/phraseTokens";
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
/*  A walk not yet done, opened on a step already answered, shows its answer */
/*  as a "✓ …" line over a black Next. Helper words stay editable on any     */
/*  part: a tap stands the walk there (C3, B10). A walk opened again once    */
/*  done is a scroll (N259): no buttons, but the helper words' after a tap,  */
/*  which go again once chosen.                                              */
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
  /** The One thing walk's helper words, which come on their own (N309 item
   *  3): the chat says them as the walk's, not as the speaker's pick. */
  auto?: boolean;
  /** Words that are not the paragraph's (the Clearer version's sentence):
   *  saved to the slide from the practice they were practised in. */
  practiceId?: string | null;
};

/** "Last time: {the tip}. You did." with this Take's clip on that slide
 *  (founder 2026-10-31, N309 item 1). */
export type FeedbackWalkLastTime = { tip: string; clip: WalkClip };

/** The Sniper's helper words: the stretch's words as the paragraph that
 *  says them has them, within the cap of eight (`sniperWords`, N309 item 3),
 *  read once by the host. */
export type FeedbackWalkTempoWords = { partId: string; paragraphText: string; text: string; span: RootPhraseSpan };

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
  /** Will's written messages reach this speaker (the walk_voice ring, N565):
   *  null while the ring read is on its way; off by default. */
  walkVoiceOn?: boolean | null;
  /** A guest known to the caller. Without it the page's guest gate decides
   *  (GuestGateContext), exactly as the Feedback sheet asks it. */
  guest?: boolean;
  /** Opens the sign-up dialog for a guest known to the caller. */
  onGuest?: () => void;
  onSaveHelperWords: (save: FeedbackWalkHelperWords) => void;
  /** "Accept and practise" (or "Accept", or the One thing walk's "Try it")
   *  on a clearer version: the host writes the speaker's decision through
   *  the accept lane. The walk moves on at once; it never waits on the
   *  write. `label`: the words the speaker tapped, for their bubble. */
  onAcceptClearer?: (item: R, label?: string | null) => void;
  /** "Keep my words" (the One thing walk's "Keep mine"): the host records
   *  the decline; the speaker's own sentence is practised. */
  /** `label` null: the One thing walk's tap, no message (backend N452). */
  onKeepWords?: (item: R, label?: string | null) => void;
  /** The practise's calls (open, upload, check). Without them a practise
   *  screen is never reached: "Accept and practise" goes past it. */
  practise?: WalkPractiseIO<R> | null;
  /** O5's limit on the machine's read; tests shorten it. */
  readLimitMs?: number;
  /** How long the fix waits on its AI clip before the words (N373);
   *  tests shorten it. */
  clipWaitMs?: number;
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
    /** The One thing walk's fix with no AI clip: its tip, for "Last
     *  time" (N370). */
    fixTip?: string | null,
    /** The One thing walk's fix: the AI clip's phrase, bold in the chat's
     *  copy of the speaker's words as in the walk (founder 2026-11-03). */
    phrase?: string | null,
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
   *  posts it to the chat. Nothing is drawn from it. `one`: the One thing
   *  walk's one moment (N309). */
  onOthers?: (at: number, of: number, from: string | null, answer: string | null, one?: boolean) => void;
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
  /** The stretch is still being asked: the Sniper's step, there before it
   *  (the server chose it, C-SNIPER), shows the typing dots (B8). */
  tempoAsking?: boolean;
  /** The tempo step as the chat kept it: a walk played again shows it so
   *  (N247). */
  tempoSaid?: readonly WalkTempoLine[];
  /** What the tempo step did, for the chat and for Will (N166 step 4);
   *  `one`: as the One thing walk's fix, the Sniper (N309). */
  onTempo?: (event: TempoEvent, one?: boolean) => void;
  /** The One thing walk's "Last time" (N309 item 1), when the last Take's
   *  fix rose; drawn under the hello when it is there as the walk opens. */
  lastTime?: FeedbackWalkLastTime | null;
  /** The level of the One thing walk's one judged moment (N309 item 2). */
  othersLevel?: OthersLevel | null;
  /** The Sniper's helper words, when its stretch's words can be (N309). */
  tempoWords?: FeedbackWalkTempoWords | null;
  /** The Sniper's slide, as the bar names a slide (its title from the deck,
   *  else "Slide N"; backend N435 item 7); null: "Tempo". */
  tempoSlide?: string | null;
  /** The helper words saved on a paragraph: the finished walk shows them. */
  helperWordsOf?: ((partId: string) => string | null) | null;
  /** "Close" under "Lesson done." (N309 item 4): the review is over; the
   *  host writes its end, then the walk closes back to the chat. */
  onLessonDone?: () => void;
  /** The Take's one quote from the speaker's notebook, under a Clearer
   *  version's Good job (backend N268). Absent: none. */
  quotes?: WalkQuoteIO | null;
};

const NO_LINES: readonly WalkTempoLine[] = [];

const NO_EDITS: ReadonlySet<string> = new Set();

/** The AI bubble a screen showed, for the chat. */
export type WalkAiShown = AiVoiceLines & { practiceId: string };

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

/** The steps a practise is opened from; ✕ on the recorder goes back there. */
const OPENERS = new Set(["clearer", "exVideo", "encourage", "late"]);

/** The One thing walk's fix opens on one of these, under "And now, one
 *  thing to improve:" (N309 item 1). */
const FIX_OPENERS: ReadonlySet<string> = new Set(["clearer", "exVideo", "tempo"]);

/** The served Sniper's wait on its stretch (useClipWait), one per Take. */
const sniperSeed = (takeId: string | null): string => `tempo:${takeId ?? ""}`;

/** Whether the Sniper's step draws its game, as Tempo does: played again,
 *  what the chat kept of it; live, once its stretch is in, unless the step
 *  waited it out first (N373's bound). With none drawn, the walk promises
 *  no fix and names no Sniper: their best, their helper words, "Lesson
 *  done." (C2, T, N374). */
function sniperDraws(on: { tempo: TempoStretch | null; tempoSaid: readonly WalkTempoLine[]; takeId: string | null }, s: WalkStep): boolean {
  if (s.replay) return on.tempoSaid.length > 0;
  return !s.readOnly && on.tempo != null && !clipWaitedOut(sniperSeed(on.takeId));
}

/** The helper words the One thing walk gives (N309 item 3): the words, and
 *  how they are saved; none to save when they are already the saved ones.
 *  `sniper`: the words are the Sniper's stretch's, so the bar names its slide. */
type OneWords = { text: string; save: FeedbackWalkHelperWords | null; practice?: Promise<string | null> | null; opening?: boolean; sniper?: boolean };

/** How long the helper words wait for the Clearer version's practice still
 *  being opened (a Skip in its round trip) before they are drawn. */
const WORDS_OPEN_WAIT_MS = 1500;

/** The steps whose dock is the recorder or a try being checked. */
const RECORDER = new Set(["practise", "processing"]);

/** The dock holds a recorder: a practise's, or the tempo step's own. */
const recorderDocked = (thread: HTMLElement | null) =>
  thread?.querySelector("[data-walk-dock] [data-walk-recording-strip]") != null;

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
  walkVoiceOn = false,
  guest = false,
  onGuest,
  onSaveHelperWords,
  onAcceptClearer,
  onKeepWords,
  practise: practiseIO = null,
  readLimitMs,
  clipWaitMs = AI_CLIP_WAIT_MS,
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
  tempoAsking = false,
  tempoSaid = NO_LINES,
  onTempo,
  quotes: quotesIO = null,
  lastTime = null,
  othersLevel = null,
  tempoWords = null,
  tempoSlide = null,
  helperWordsOf = null,
  onLessonDone,
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
  // A walk opened again once done is a scroll (N259): no buttons, but the
  // helper words' while the speaker edits them (their pick's key), and the
  // words as saved, which a Keep these puts back.
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, PhraseSelection | null>>({});
  const guestBlock = useGuestBlock();
  // The live thread's root (WalkThread): its leaving copy, and its dock.
  const frame = useRef<HTMLDivElement | null>(null);

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
    setSaved(replayPicks(opened));
    setEditing(null);
    setAnswers({});
    setResume(null);
    setAt(asked.at);
    setReach(Math.max(asked.at, asked.head ?? asked.at));
    openedAt.current = asked.at;
  }, [seq]);

  const plan = walk.plan;
  // Will's written praise for their best (backend N565), when the
  // walk_voice ring reaches the speaker: asked as the walk opens, so it is
  // ready by the time their best is shown.
  const bestStep = plan.find((s) => s.one && s.key === "praise" && !s.replay);
  const bestSnippet = bestStep?.moment != null ? (walk.moments[bestStep.moment]?.clip?.snippetId ?? null) : null;
  const bestSaid = useBestSaid(takeId, bestSnippet, walkVoiceOn);
  const step = plan[at] ?? plan[0];
  const scroll = walk.scroll === true;

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
    // In a scroll the only buttons are an edit's: they go, the words not
    // saved go back, and the walk stays where it is (N259).
    if (scroll) {
      if (editing !== null) setPicks((p) => ({ ...p, [editing]: saved[editing] ?? null }));
      setEditing(null);
      return;
    }
    if (resume !== null) {
      setResume(null);
      land(plan, resume, undefined);
      return;
    }
    if (onForward?.()) return;
    land(plan, at + 1, "forward");
  }, [at, plan, land, onForward, resume, scroll, editing, saved]);
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
  const quotes = useWalkQuote<R>({ io: quotesIO, plan, at, moments: walk.moments });
  const practise = useWalkPractise<R>({
    io: practiseIO,
    plan,
    at,
    moments: walk.moments,
    blocked,
    relay,
    readLimitMs,
    // Its tries' practice, else the One thing fix's as the chat kept it.
    replayPracticeOf: (moment) => replayTries?.[moment]?.practiceId ?? walk.replay?.clips?.[moment]?.practiceId,
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
    return s.key === "exVideo" && !s.one && moment?.highest && !moment.praised ? topMomentLine("example", moment) : null;
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
    // The One thing walk's fix says its line above the bubble (N309), only
    // when their best's clip follows it (N377 item 2).
    const lead = s.one && fixBest(walk.moments, s.moment) ? { lead: ONE_THING_COPY.likeConfident } : {};
    return lines && practiceId ? { ...lines, ...lead, practiceId } : null;
  };
  /** A voice correction with nothing to offer (founder 2026-10-21, N108):
   *  no exercise served and no AI clip, live once its ask came back without
   *  one, played again when it had no try. Never Line A on its own. The
   *  Take's most confident moment is not one: it says its own line and is
   *  said again (N109). A praised moment's practise with no AI clip is one
   *  too: the praise stands on its own (N122). */
  const bare = (s: WalkStep | undefined, i: number): boolean => {
    const moment = s?.moment == null ? undefined : walk.moments[s.moment];
    // The One thing walk's fix stays, with or without its AI clip: it is
    // the one thing (N309).
    if (s?.one) return false;
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
  // The One thing walk says "Hi {name}." (N309 item 1).
  const oneThing = plan.some((s) => s.one);
  const hello = oneThing ? ONE_THING_COPY.hello(firstName) : WALK_COPY.hello(firstName, firstTake);
  const helloSeq = useRef<number | null>(null);
  if (seq !== null && helloSeq.current === null) helloSeq.current = seq;
  const helloTold = useRef(false);
  // The words the chat was told: the walk keeps them, so the hello never
  // changes in place once said (B5), whatever arrives after.
  const [helloSaid, setHelloSaid] = useState<string | null>(null);
  useEffect(() => {
    if (seq === null || helloTold.current || !step || step.overlay === false) return;
    helloTold.current = true;
    setHelloSaid(hello);
    const greet: WalkStep = { key: "hello" };
    shownRef.current?.(greet, null, (bank) => sayLine(greet, bank), null, hello);
    // Once per walk: the words are fixed when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step]);
  // "Last time: {the tip}. You did." (N309 item 1): under the hello, once,
  // when the last Take's fix rose. Held from when it is there while the walk
  // still stands where it opened, so it never lands above steps already
  // walked; told to the chat once.
  const [last, setLast] = useState<FeedbackWalkLastTime | null>(null);
  const lastTold = useRef(false);
  useEffect(() => {
    if (seq === null || lastTold.current || !lastTime || !oneThing || walk.replay || at !== openedAt.current) return;
    lastTold.current = true;
    setLast(lastTime);
    const said: WalkStep = { key: "last" };
    shownRef.current?.(said, null, (bank) => sayLine(said, bank), null, ONE_THING_COPY.lastTime(lastTime.tip));
    // Once per walk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, lastTime, at, oneThing]);
  // "And here's one moment to try another way:" (N309 item 1): told to the chat once,
  // as the walk reaches the fix.
  const toldOne = useRef(new Set<number>());
  useEffect(() => {
    if (seq === null || !step || step.replay || !step.one || !FIX_OPENERS.has(step.key) || toldOne.current.has(seq)) return;
    // The Sniper's line waits for its game: none drawn, none said (T).
    if (step.key === "tempo" && !sniperDraws({ tempo, tempoSaid, takeId }, step)) return;
    toldOne.current.add(seq);
    const said: WalkStep = { key: "one", ...(step.moment != null ? { moment: step.moment } : {}) };
    shownRef.current?.(said, null, (bank) => sayLine(said, bank), null, ONE_THING_COPY.one);
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step, tempo]);
  // "The rest of this Take held up just as well." (backend N551): told to the chat once, as a
  // good Take's walk reaches its helper words.
  const toldClear = useRef(new Set<number>());
  useEffect(() => {
    if (seq === null || !step || step.replay || !step.clear || toldClear.current.has(seq)) return;
    toldClear.current.add(seq);
    const said: WalkStep = { key: "one" };
    shownRef.current?.(said, null, (bank) => sayLine(said, bank), null, ONE_THING_COPY.nothingToFix);
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step]);
  // The line between moments and after the last (N285): told to the chat
  // once, before the step it leads into; never for a step played again.
  const toldLead = useRef(new Set<string>());
  useEffect(() => {
    if (seq === null || !step || step.replay) return;
    const lead = momentLead(plan, at);
    const told = `${seq}:${step.moment ?? step.key}:${lead}`;
    if (!lead || toldLead.current.has(told)) return;
    toldLead.current.add(told);
    const said: WalkStep = { key: "lead", kind: lead, ...(step.moment != null ? { moment: step.moment } : {}) };
    shownRef.current?.(said, null, (bank) => sayLine(said, bank), null, leadLine(lead));
    // Once per step it leads into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step, at, plan]);
  useEffect(() => {
    if (seq === null || !step || step.overlay === false) return;
    const moment = step.moment != null ? (walk.moments[step.moment] ?? null) : null;
    // The Exercise is told to the server at once (the coach's queue); its
    // chat bubble waits for whether a clip is coming (below).
    if (step.key === "exVideo") {
      reachedRef.current?.(step, moment);
      return;
    }
    // Their best waits for Will's words, so the chat says what the walk drew
    // (N565): his message, or the signed lines when there is none.
    if (step.one && step.key === "praise" && !step.replay && !bestSaid.settled) return;
    const line =
      step.one && step.key === "praise" && !step.replay
        ? bestSaid.text
        : step.key === "improved"
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
    // aiKey changes when the clip's answer lands; bestSaid when Will's words do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, step, walk.moments, aiKey, bestSaid.settled]);
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
      const say = (bank: WalkBankKey) => sayLine(s, bank);
      const ai = chatAi(s, i);
      // The One thing walk's fix with no AI clip: the chat says what the
      // walk drew, and "Last time" keeps its tip (N370). With a clip on its
      // way, the same lines are the chat's words should it never come.
      const noClip = s.one ? oneThingNoClip(say, practise.aiVoiceOf(s.moment)?.clip, moment?.exercise) : null;
      // The line above it only with their best's clip after it (N377 item 2).
      const like = s.one && fixBest(walk.moments, s.moment) ? [ONE_THING_COPY.likeConfident] : [];
      const lines = [...like, ...(noClip?.lines ?? [])];
      const body = s.one ? lines.join("\n") || null : null;
      shownRef.current?.(s, moment, say, ai, body, ai ? null : (noClip?.tip ?? null), s.one ? (practise.aiVoiceOf(s.moment)?.clip?.phrase ?? null) : null);
    });
  });
  // The bare correction's Exercise and practise leave the live walk once its
  // ask is answered (N108): it was reached, so the coach's queue heard it.
  // It is walked as a good moment, never skipped (founder 2026-10-30, N284,
  // "Treat as good"): its helper words stand in their place, unless the
  // plan gives them already (a praise's, N122).
  const aiVoiceOf = practise.aiVoiceOf;
  useEffect(() => {
    if (seq === null || !step || step.replay || !bare(step, at)) return;
    const end = loopEnd(plan, at);
    const helpers = goodJobHelpers(plan, step);
    setReach((r) => (r > at ? Math.max(at, r - (end - at) + helpers.length) : r));
    relay([...plan.slice(0, at), ...helpers, ...plan.slice(end)], at, "forward");
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

  /** The helper words the One thing walk gives after its fix, on their own
   *  (N309 item 3): the words of their own sentence the fix leans on (the AI
   *  clip's quoted phrase, their own sentence kept), or the Clearer
   *  version's sentence, whole, whatever their length (N323 item 2); the
   *  Sniper's stretch within the cap of eight words. Found where they are
   *  saved. When the fix gives none (no fix at all, a tip that quotes no
   *  phrase, a stretch past eight words), their best's own words, whole,
   *  saved the same way (backend N374); none of those either, and the walk
   *  goes on to "Lesson done.". Played again, the words as saved: the fix's
   *  paragraph's, the Sniper's stretch's paragraph's (C3, B10), else their
   *  best's. */
  // The moments whose Clearer practice was still opening when the helper
  // words' bound ran out: decided then, their best's words (N374), drawn,
  // saved and said alike, whatever the open answers later (C3).
  const wordsLate = useRef(new Set<number>());
  const fixWords = (s: WalkStep): OneWords | null => {
    const bestAt = plan.find((x) => x.one && x.key === "praise")?.moment;
    const best = bestAt == null ? undefined : walk.moments[bestAt];
    const own = (moment: FeedbackWalkMoment<R>, text: string | null | undefined): OneWords | null => {
      const words = text?.trim();
      if (!words) return null;
      const span = quoteSpan(moment.paragraphText, words);
      return span
        ? { text: helperWordsSaid(stripRichMarkers(span.text)), save: { partId: moment.partId, span, paragraphText: moment.paragraphText, auto: true } }
        : null;
    };
    const savedOn = (partId: string | undefined): OneWords | null => {
      const words = partId ? helperWordsOf?.(partId) : null;
      return words ? { text: helperWordsSaid(stripRichMarkers(words)), save: null } : null;
    };
    const saved = (moment: FeedbackWalkMoment<R> | undefined) => savedOn(moment?.partId);
    const moment = s.of == null ? undefined : walk.moments[s.of];
    if (s.replay) {
      if (moment) return saved(moment) ?? saved(best);
      const stretch = savedOn(tempoWords?.partId);
      return stretch ? { ...stretch, sniper: true } : saved(best);
    }
    const fixGives = (): OneWords | null => {
      if (!moment) {
        // The Sniper's words only once its game was drawn (T, N374).
        const sniper = plan.find((x) => x.key === "tempo");
        return s.of == null && tempoWords && sniper && sniperDraws({ tempo, tempoSaid, takeId }, sniper)
          ? { text: tempoWords.text, save: { partId: tempoWords.partId, span: tempoWords.span, paragraphText: tempoWords.paragraphText, auto: true }, sniper: true }
          : null;
      }
      const opener = plan.find((x) => x.moment === s.of && (x.key === "clearer" || x.key === "exVideo"));
      if (opener?.key === "clearer" && moment.clearer) {
        const tried = plan.find((x) => x.key === "practise" && x.moment === s.of);
        if (!tried) return null;
        // Their own sentence, without the hesitations it opens with (N435 item 5).
        if (tried.kind === "keep") return own(moment, withoutOpeningFillers(moment.clearer.said));
        // Without the sentence's punctuation at either end, as after "Keep
        // mine" (B7; backend N440 item 7). A practice that could not be
        // opened saves nothing: their best's words instead (N374).
        const sentence = helperWordsSaid(moment.clearer.say.trim());
        const practice = practise.practiceOf(moment.index);
        if (!sentence || !practice || wordsLate.current.has(moment.index)) return null;
        return {
          text: sentence,
          save: { partId: moment.partId, span: { text: sentence, start: null, end: null }, paragraphText: moment.paragraphText, auto: true },
          practice,
          opening: practise.practiceOpening(moment.index),
        };
      }
      if (opener?.key === "exVideo") return own(moment, practise.aiVoiceOf(moment.index)?.clip?.phrase);
      return null;
    };
    return fixGives() ?? (best ? own(best, best.said) : null);
  };

  const ctx: ScreenCtx<R> = {
    walk,
    bestSaid,
    reasons,
    at: (s) => plan.indexOf(s),
    bare: (s) => bare(s, plan.indexOf(s)),
    head: at,
    clipWaitMs,
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
      const key = pickKey(s);
      // Another picker's words left unsaved go back as they were.
      const left = scroll && editing !== null && editing !== key ? { [editing]: saved[editing] ?? null } : {};
      setPicks((p) => ({ ...p, ...left, [key]: next }));
      if (scroll) setEditing(key);
    },
    standOn: (s) => {
      const here = plan.indexOf(s);
      // The recorder never gives way (B9): moving off it stops the mic. The
      // tempo step's recorder is its own, so the dock is asked too.
      if (here < 0 || here === at || s.readOnly || RECORDER.has(step.key) || recorderDocked(frame.current)) return false;
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
      if (scroll) {
        setSaved((w) => ({ ...w, [pickKey(s)]: picked }));
        setEditing(null);
        return;
      }
      forward();
    },
    accept: (s, moment) => {
      if (s.replay) return forward();
      if (blocked(s) || !moment.clearer) return;
      // The One thing walk's tap is no message, in the walk or the chat (N452).
      if (s.one) onAcceptClearer?.(moment.clearer.item, null);
      else onAcceptClearer?.(moment.clearer.item);
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
      if (s.one) onKeepWords?.(moment.clearer.item, null);
      else onKeepWords?.(moment.clearer.item);
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
    quotes,
    summary,
    storedSummary,
    editedWords,
    nav: (s, moment) => stepNav(ctx, s, moment),
    say: walkLines.say,
    onOthers,
    othersJudged,
    tempo,
    tempoAsking,
    tempoSaid,
    onTempo,
    tempoSlide,
    othersLevel,
    fixWords: (s) => fixWords(s),
    wordsLate: (s) => {
      const moment = s.of == null ? undefined : walk.moments[s.of];
      if (moment) wordsLate.current.add(moment.index);
    },
    saveWords: (s, words) => {
      if (s.replay || blocked(s) || !words.save) return;
      const save = words.save;
      if (words.practice) {
        // The Clearer version's sentence: from the practice it was opened on.
        void words.practice.then((practiceId) => {
          if (practiceId) return onSaveHelperWords({ ...save, practiceId });
          // Not opened after all: their best's words, as the walk now
          // gives them (N374).
          const instead = fixWords(s);
          if (instead?.save && !instead.practice) onSaveHelperWords(instead.save);
        });
      } else onSaveHelperWords(save);
    },
    finish: () => {
      onLessonDone?.();
      close();
    },
    last,
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

  return (
    <div data-feedback-walk data-walk-step={step.key}>
      {/* The whole window on a wide screen, the words in the Lounge's
          column (globals.css, "The lens on a computer"). */}
      <WalkStage
        screen={stage}
        render={(s, ghost) => (
          <WalkThread
            ghost={ghost}
            frame={frame}
            opening={s.seq}
            current={s.at}
            buttons={!scroll || editing !== null}
            onClose={close}
          >
            {renderThread(ctx, s.head, s.seq, backFromPractise, s.at, s.seq !== null && s.seq === helloSeq.current ? walkTop(helloSaid ?? hello, last) : [])}
          </WalkThread>
        )}
      />
    </div>
  );
}

/** The line between moments, or after the last (founder 2026-10-30, N285). */
const leadLine = (lead: "next" | "done") => MOMENT_LEAD_LINES[lead];

/** What the walk's first opening says above its first step, landing
 *  first, in order, one bubble at a time (B7, N440; the prototype's
 *  start()): the hello (founder 2026-10-23, N120), then "Last time: {the
 *  tip}. You did." and this Take's clip on that slide, as the speaker's own
 *  orange bubble (founder 2026-10-31, N309 item 1). */
function walkTop(hello: string, last: FeedbackWalkLastTime | null): ReactNode[] {
  return [
    <div key="hello" data-walk-hello className="contents">
      <WalkMessage>
        <span>{hello}</span>
      </WalkMessage>
    </div>,
    ...(last
      ? [
          <div key="last" data-walk-last className="contents">
            <WalkMessage>
              <span>{ONE_THING_COPY.lastTime(last.tip)}</span>
            </WalkMessage>
          </div>,
          <div key="last-clip" data-walk-last className="contents">
            <WalkPlayer
              look="me"
              seed="last-time"
              src={last.clip.src}
              startOffsetMs={last.clip.startOffsetMs}
              durationMs={last.clip.durationMs}
              label={COPY.pagerMoment}
            />
          </div>,
        ]
      : []),
  ];
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
  /** How long the fix waits on its AI clip before the words (N373). */
  clipWaitMs: number;
  coachNote: FeedbackWalkCoachNote | null;
  takeIndex: number | null;
  /** The Take the walk is about: other speakers' set for it (N119). */
  takeId: string | null;
  /** Will's written praise for their best, or the signed line (N565). */
  bestSaid: WalkVoiceSaid;
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
  quotes: WalkQuotes;
  summary: (() => Promise<string | null>) | null;
  storedSummary: WalkStoredSummary | null;
  editedWords: ReadonlySet<string>;
  nav: (step: WalkStep, moment: FeedbackWalkMoment<unknown>) => WalkNav;
  /** The signed line a screen says (D-FW-3). */
  say: SayLine;
  onOthers?: (at: number, of: number, from: string | null, answer: string | null, one?: boolean) => void;
  /** Green moments' reasons that arrived after the walk opened. */
  reasons: WalkPraiseReasons | null;
  othersJudged: number;
  tempo: TempoStretch | null;
  /** The stretch is still being asked (C-TEMPO). */
  tempoAsking: boolean;
  tempoSaid: readonly WalkTempoLine[];
  onTempo?: (event: TempoEvent, one?: boolean) => void;
  /** The Sniper's slide for the bar (backend N435 item 7). */
  tempoSlide: string | null;
  /** The One thing walk's one judged moment's level (N309 item 2). */
  othersLevel: OthersLevel | null;
  /** The One thing walk's helper words after its fix (N309 item 3). */
  fixWords: (step: WalkStep) => OneWords | null;
  /** The bound on the Clearer practice's open ran out first: the words are
   *  their best's from now on (N374, C3). */
  wordsLate: (step: WalkStep) => void;
  /** Saves them, once, as the paragraph's (or the slide's) helper words. */
  saveWords: (step: WalkStep, words: OneWords) => void;
  /** "Close" under "Lesson done.": back to the chat (N309 item 4). */
  finish: () => void;
  /** "Last time" as drawn under the hello (N309 item 1). */
  last: FeedbackWalkLastTime | null;
};

const noop = () => undefined;

/** A step's name: "Slide N" (founder 2026-10-15: no moment count), "Slide N
 *  · helper words" on the helper words. The thread's mark and bar say it;
 *  ‹ › are the thread's own (WalkThread). */
function stepNav(_ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment): WalkNav {
  const label = slideName(moment);
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

/** The slide as the bar names it: its title in the speaker's deck, else
 *  "Slide N" (backend N397; the locked prototype's `dots()` says the
 *  slide's title). Until 2026-11-03 the bar always said "Slide N". */
function slideName(moment: FeedbackWalkMoment): string | null {
  return moment.slideTitle?.trim() || moment.slideLabel;
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
/** The moment's own words in its clip's bubble (the walk's prototype,
 *  `clip(u.best.text)` and `clip(f.text)`): their best and the AI clip's
 *  fix, the fix with its phrase bold (founder 2026-11-03). Null when none
 *  was served. */
function saidWords(moment: FeedbackWalkMoment, phrase?: string | null): ReactNode {
  return moment.said ? <Bolded text={moment.said} phrase={phrase} /> : null;
}

/** A line with the AI clip's phrase bold (founder 2026-11-03). */
function Bolded({ text, phrase }: { text: string; phrase?: string | null }) {
  return (
    <span>
      {phrasePieces(text, phrase).map((p, i) => (p.bold ? <strong key={i} data-walk-phrase>{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </span>
  );
}

function Clip({ moment, words, replay, chip = false }: { moment: FeedbackWalkMoment; words?: ReactNode; replay?: string; chip?: boolean }) {
  if (!moment.clip && !words) return null;
  return (
    <WalkPlayer
      look={chip ? "chip" : "me"}
      seed={replay ? `replay-${moment.index}` : `moment-${moment.index}`}
      src={moment.clip?.src ?? null}
      startOffsetMs={moment.clip?.startOffsetMs}
      durationMs={moment.clip?.durationMs}
      label={replay ?? moment.slideLabel ?? COPY.pagerMoment}
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
        {praiseBubble(moment, words).map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </WalkMessage>
      {reason ? <PraiseReasonBubble reason={reason} /> : null}
      <CoachAnswerBubble moment={moment} />
    </WalkOverlay>
  );
}

/** Their best (founder 2026-10-31, N309 item 1): the clip, "This was your
 *  most confident moment." and "Why it worked: {the cue line}"; nothing to
 *  practise; Next. */
function Best(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
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
      <Clip moment={moment} words={saidWords(moment)} />
      {/* Will's own words for it when the walk_voice ring reaches the
          speaker (N565), the typing dots while they come, else the signed
          lines. Never swapped in place: the bubble lands once. */}
      {!ctx.bestSaid.settled ? (
        <WalkTyping />
      ) : ctx.bestSaid.text ? (
        <WalkMessage>
          <span data-walk-best="written">{ctx.bestSaid.text}</span>
        </WalkMessage>
      ) : (
        <WalkMessage>
          {bestBubble(moment).map((line, i) => (
            <span key={i} data-walk-best={i === 0 ? "" : "why"}>
              {line}
            </span>
          ))}
        </WalkMessage>
      )}
      <CoachAnswerBubble moment={moment} />
    </WalkOverlay>
  );
}

/** The Clearer version as the One thing walk's fix (N309 item 1): the
 *  speaker's words with their clip, "Say it straight:" and the sentence in
 *  bold; "Try it" with the record dot, "Keep mine". With practice off, the
 *  fix alone and Next. */
function OneClearer<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const clearer = moment.clearer;
  if (!clearer) return null;
  const given = ctx.answered(step);
  const practiseOff = step.kind === "accept";
  const footer = given ? (
    <Answered ctx={ctx} line={null} />
  ) : practiseOff ? (
    <WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />
  ) : (
    <WalkFooter
      dot
      pill={{ label: ONE_THING_COPY.tryIt, onClick: () => ctx.accept(step, moment), testId: "walk-forward" }}
      links={[{ label: ONE_THING_COPY.keepMine, onClick: () => ctx.keep(step, moment), testId: "walk-keep" }]}
    />
  );
  return (
    <WalkOverlay testId={testId(step)} nav={ctx.nav(step, moment)} onClose={ctx.close} footer={footer}>
      <LevelHere moment={moment} />
      <Clip moment={moment} words={<span>{clearer.said}</span>} />
      <WalkMessage coach={clearer.byCoach === true} wide={clearer.byCoach === true}>
        {clearer.byCoach && moment.coachAnswer?.videoUrl ? (
          <CoachVideo src={moment.coachAnswer.videoUrl} className="my-2 w-full flex-none" />
        ) : null}
        <span>{ONE_THING_COPY.sayStraight}</span>
        <span data-walk-say className="font-semibold">
          {clearer.say}
        </span>
      </WalkMessage>
      {clearer.byCoach ? null : <CoachAnswerBubble moment={moment} />}
    </WalkOverlay>
  );
}

/** The One thing walk's helper words, on their own (N309 item 3): "These
 *  are your helper words. …" and the words alone, in bold, saved as the
 *  paragraph's helper words as they land; then the walk goes on to its end
 *  by itself. None to give, nothing drawn. */
function Words({ ctx, step }: { ctx: ScreenCtx; step: WalkStep }) {
  const words = ctx.fixWords(step);
  // The Clearer version's practice still being opened: whose words these
  // are is known once it has (their best's if it never opens, N374), within
  // a short bound, so what is drawn, saved and said is the same (C3). Still
  // opening at the bound: decided then, their best's, never changed after.
  const opening = words?.opening && words.practice ? words.practice : null;
  const [waited, setWaited] = useState<Promise<string | null> | null>(null);
  const late = useRef(() => ctx.wordsLate(step));
  late.current = () => ctx.wordsLate(step);
  useEffect(() => {
    if (!opening) return;
    let on = true;
    const done = () => {
      if (on) setWaited(opening);
    };
    const bound = window.setTimeout(() => {
      if (on) late.current();
      done();
    }, WORDS_OPEN_WAIT_MS);
    void opening.then(() => {
      window.clearTimeout(bound);
      done();
    });
    return () => {
      on = false;
      window.clearTimeout(bound);
    };
  }, [opening]);
  if (opening && waited !== opening) return waitDots(ctx, step);
  if (!words) return <PassBy onPass={() => ctx.forwardFrom(step)} />;
  return <WordsShown ctx={ctx} step={step} words={words} />;
}

function WordsShown({ ctx, step, words }: { ctx: ScreenCtx; step: WalkStep; words: OneWords }) {
  const past = useMountedAsPast();
  const go = useRef({ ctx, step, words });
  go.current = { ctx, step, words };
  useEffect(() => {
    if (past || step.replay) return;
    const now = go.current;
    now.ctx.saveWords(now.step, now.words);
  }, [past, step.replay]);
  // On once its two bubbles have landed (backend N440; was at once, so they
  // showed in one frame with "Lesson done." behind them).
  const landed = () => {
    if (past || step.replay) return;
    go.current.ctx.forwardFrom(go.current.step);
  };
  return (
    <WalkOverlay testId={testId(step)} onClose={ctx.close} footer={null} onLanded={landed}>
      <WalkMessage>
        <span>{ONE_THING_COPY.helperWords}</span>
      </WalkMessage>
      <WalkMessage>
        <span data-walk-helper-words className="font-semibold">
          {words.text}
        </span>
      </WalkMessage>
    </WalkOverlay>
  );
}

/** "Lesson done." and Close, back to the chat (N309 item 4): no "Record
 *  Take N" and no summary in the walk. Played again, the line alone. */
function Done(ctx: ScreenCtx, step: WalkStep) {
  const footer = step.replay || step.readOnly ? null : (
    <WalkFooter pill={{ label: COPY.pillClose, onClick: ctx.finish, testId: "walk-close" }} />
  );
  return (
    <WalkOverlay testId={testId(step)} onClose={ctx.close} footer={footer}>
      <WalkMessage>
        <span data-walk-done>{ONE_THING_COPY.lessonDone}</span>
      </WalkMessage>
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
    // In a scroll, Skip only ends the edit (N259).
    if (!ctx.walk.scroll) ctx.answer(step, "skip");
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
  if (step.one) return <OneExerciseBody ctx={ctx} step={step} moment={moment} />;
  const exercise = moment.exercise;
  // The weakest (founder 2026-10-30, N289): its own line above its clip
  // (the level's instead when it carries one), then Line A and the
  // strongest moment's clip played again, so "your confident moment" is
  // one the speaker has just heard.
  const weakest = moment.slot === "weakest" && !moment.praised;
  const strongest = weakest ? ctx.walk.moments.find((m) => m.slot === "strongest" && m.clip) : undefined;
  // A praised moment's practise follows its praise (N122): its clip is
  // just above, and it has the AI clip or nothing, never Line A.
  return (
    <>
      {moment.praised ? null : <LevelHere moment={moment} />}
      {weakest && !moment.planLevel ? (
        <WalkMessage>
          <span data-walk-weakest>{WALK_COPY.weakestOpener}</span>
        </WalkMessage>
      ) : null}
      {moment.praised ? null : <Clip moment={moment} />}
      {weakest ? (
        <WalkMessage>
          <span>{WALK_COPY.lineA}</span>
        </WalkMessage>
      ) : null}
      {strongest ? <Clip moment={strongest} replay={WALK_COPY.confidentReplay} /> : null}
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
          {exercise?.instruction || !(moment.highest || weakest) ? <span>{exercise?.instruction ?? WALK_COPY.lineA}</span> : null}
        </WalkMessage>
      ))}
      <CoachAnswerBubble moment={moment} />
    </>
  );
}

/** What the One thing walk's fix shows of its AI clip (N370, N373): the
 *  AI bubble (`lines`), or the words with no clip (`noClip`), and under
 *  them the late clip's player alone (`latePlayer`). */
function useFixClip<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const state = ctx.practise.aiVoiceOf(moment.index);
  const say = (bank: WalkBankKey) => ctx.say(step, bank);
  const ai = aiVoiceShown(ctx.walk.plan, ctx.at(step), state, say);
  const seed = `ai-ex-${ctx.takeId ?? ""}-${moment.index}`;
  // Ten seconds on a clip still being made, then the tip in words; a clip
  // that comes later joins them as its player alone (N373 item 1). Once
  // the first try began, a clip not yet seen never lands above it (N373
  // item 2). A walk played again shows what is there.
  const live = !step.replay && !step.readOnly;
  const waited = useClipWait(seed, live && ai === "pending", ctx.clipWaitMs);
  const tried =
    Boolean(ctx.practise.tryOf(moment.index)) ||
    ctx.walk.plan.some((s, i) => s.key === "practise" && s.moment === moment.index && i <= ctx.head);
  const allowed = useClipBeforeTry(seed, Boolean(ai && ai !== "pending"), live && tried);
  const shown = ai && (!live || (allowed && !(ai === "pending" && (waited || tried)))) ? ai : null;
  const lines = shown === "pending" ? oneThingAiLines(say, state?.clip) : waited && shown ? null : shown;
  const latePlayer = waited && shown && shown !== "pending";
  // No AI clip coming (its check failed, the provider or the limits
  // refused, no voice yet), or one waited out: the tip in words, and the
  // exercise's video and instruction when one is served (N370).
  // Played again with no clip naming a tip: the tip the chat kept (N373 item 2).
  const kept = step.replay ? (ctx.walk.replay?.clips?.[moment.index]?.tip ?? null) : null;
  const noClip = lines || ctx.practise.aiVoiceAsking(moment.index) ? null : oneThingNoClip(say, state?.clip, moment.exercise, kept);
  return { state, seed, lines, latePlayer, noClip };
}

/** The AI clip after their best, as the One thing walk's fix (N309 item
 *  1): the speaker's clip, "Say this one like your confident moment:",
 *  their best played again, then the AI bubble: the tip ending ", like
 *  this:", the clip, "Your turn.". With no AI clip coming, the rest stands
 *  and the try is still theirs. */
function OneExerciseBody<R>({ ctx, step, moment }: { ctx: ScreenCtx<R>; step: WalkStep; moment: FeedbackWalkMoment<R> }) {
  const best = fixBest(ctx.walk.moments, moment.index);
  const { state, seed, lines, latePlayer, noClip } = useFixClip(ctx, step, moment);
  const phrase = state?.clip?.phrase ?? null;
  // One bubble at a time, the dots before each grey one, after the line
  // that opens the fix, as the walk's other steps land (backend N440 item
  // 1; was all of them in one frame, the thread jumping past their clip).
  const part = useWalkPart();
  const [lands] = useState(() => part?.now === true && part.fresh && !step.replay && !step.readOnly);
  return (
    <WalkLanding on={lands && part?.now === true} onSettled={noop}>
      <LevelHere key="level" moment={moment} />
      <Clip key="clip" moment={moment} words={saidWords(moment, phrase)} />
      {/* The line ends on a colon: only with their best's clip after it (N377 item 2). */}
      {best ? (
        <WalkMessage key="like">
          <span data-walk-like>{ONE_THING_COPY.likeConfident}</span>
        </WalkMessage>
      ) : null}
      {/* One example to copy (N379 item 1): with the fix's own (the AI
          clip, the exercise's video), their best is a small chip. */}
      {best ? (
        lines || latePlayer || noClip?.video ? (
          <Clip key="best" moment={best} replay={WALK_COPY.confidentReplay} chip />
        ) : (
          <Clip key="best" moment={best} replay={best.slideLabel ?? COPY.pagerMoment} />
        )
      ) : null}
      {/* Read aloud as they land (N379 item 2). */}
      <div key="ai" aria-live="polite" className="contents">
        {lines ? (
          <WalkAiVoice
            seed={seed}
            state={state}
            {...lines}
            bold={phrase}
            arrive
            onPlay={() => ctx.practise.aiVoicePlayed(moment.index)}
          />
        ) : null}
        {noClip ? <FixWords seed={`${seed}-words:${noClip.video ?? ""}:${noClip.lines.join("|")}`} words={noClip} phrase={phrase} /> : null}
        {latePlayer ? (
          <WalkAiVoice seed={`${seed}-late`} state={state} line="" arrive onPlay={() => ctx.practise.aiVoicePlayed(moment.index)} />
        ) : null}
      </div>
      <CoachAnswerBubble key="coach" moment={moment} />
    </WalkLanding>
  );
}

/** Their best's clip, the fix's example (N309): the Take's strongest with a
 *  clip, never the fix itself; none when there is no such clip. Pure. */
function fixBest<R>(moments: readonly FeedbackWalkMoment<R>[], fix: number): FeedbackWalkMoment<R> | undefined {
  return moments.find((m) => m.slot === "strongest" && m.clip && m.index !== fix);
}

/** The fix's words with no AI clip (N370): the exercise's video, the tip,
 *  the instruction, "Your turn.". They land with the walk's bubble motion,
 *  never swapping in place: once per wording in the page's life, so new
 *  words land and the same words drawn again do not (N377 item 1). */
function FixWords({ seed, words, phrase }: { seed: string; words: NonNullable<ReturnType<typeof oneThingNoClip>>; phrase?: string | null }) {
  const lands = useLandsOnce(seed);
  return (
    <WalkMessage coach={words.byCoach} wide={Boolean(words.video)} className={lands ? "walk-bubble-in" : undefined}>
      {words.video ? (
        <CoachVideo
          src={words.video}
          className="mb-2 w-full max-h-[300px] flex-none [&>video]:aspect-[4/5] [&>video]:max-h-[300px] [&>video]:object-cover"
        />
      ) : null}
      {words.lines.map((l, i) => (
        <span key={i} data-walk-no-clip>
          <Bolded text={l} phrase={phrase} />
        </span>
      ))}
    </WalkMessage>
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
  const more = !step.replay && tries < maxTries(step) && !threadPraised(plan, at);
  const next = () => {
    ctx.answer(step, step.key === "improved" || step.key === "thanks" ? "ok" : "skip");
    ctx.pastLoop();
  };
  const practise = () => (tries === 0 ? ctx.exercise(step) : ctx.practiseAgain(plan[threadShownEnd(plan, at)]));
  if (!more) return <WalkFooter pill={{ label: COPY.pagerNext, onClick: next, testId: "walk-forward" }} />;
  // The One thing walk's fix (N309 item 1): "Try it" with the record dot,
  // and Skip, before the first try and after one miss. With practice off
  // there is nothing to try: Next.
  if (step.one) {
    if (!plan.some((s) => s.key === "practise" && s.moment === step.moment)) {
      // Nothing was offered, so nothing was skipped: Next posts nothing
      // and the walk says nothing (B7; backend N440 item 4; was "Skip" and
      // "Okay, we'll skip this one.").
      const on = () => {
        ctx.answer(step, "ok");
        ctx.pastLoop();
      };
      return <WalkFooter pill={{ label: COPY.pagerNext, onClick: on, testId: "walk-forward" }} />;
    }
    return (
      <WalkFooter
        dot
        pill={{ label: ONE_THING_COPY.tryIt, onClick: practise, testId: "walk-practise" }}
        links={[{ label: WALK_COPY.skip, onClick: () => ctx.skipExercise(step), testId: "walk-skip" }]}
      />
    );
  }
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
  // Played again, the moments judged in this walk with their answers
  // (N247); none judged, the step is passed by.
  const replay = Boolean(step.replay);
  // The One thing walk judges one moment of its level (N309 item 2); with
  // no level (Take 1) it judges no one.
  const one = step.one === true;
  return (
    <WalkOthers
      testId={testId(step)}
      take={ctx.takeId}
      judged={ctx.othersJudged}
      replay={replay}
      skip={Boolean(step.readOnly) || (replay && ctx.othersJudged === 0) || (one && !ctx.othersLevel)}
      onDone={() => ctx.forwardFrom(step)}
      onClose={ctx.close}
      onChat={ctx.onOthers}
      level={one ? ctx.othersLevel : null}
    />
  );
}

/** The tempo step (backend N162, N166): the stretch practised on the pace
 *  scale. With no stretch it is passed by. Played again, it is what the
 *  chat kept of it, read only (N247). */
function Tempo(ctx: ScreenCtx, step: WalkStep) {
  const kept =
    ctx.tempoSaid.length > 0 ? (
      <WalkTempoSaid
        testId={testId(step)}
        stretch={ctx.tempo}
        lines={ctx.tempoSaid}
        onNext={() => ctx.forwardFrom(step)}
        onClose={ctx.close}
      />
    ) : null;
  if (step.replay && kept) return kept;
  if (step.readOnly || step.replay) return <PassBy onPass={() => ctx.forwardFrom(step)} />;
  return <TempoLive ctx={ctx} step={step} kept={kept} />;
}

/** The tempo step live. The Sniper the server chose, its stretch still on
 *  its way: the typing dots, the walk's one wait (B8), at most as long as
 *  the fix waits on its clip (N373), then passed by as with no stretch; a
 *  stretch that comes after never draws the game in a step the walk has
 *  left. */
function TempoLive({ ctx, step, kept }: { ctx: ScreenCtx; step: WalkStep; kept: ReactNode }) {
  const asking = !ctx.tempo && ctx.tempoAsking;
  const waitedOut = useClipWait(sniperSeed(ctx.takeId), asking, ctx.clipWaitMs);
  if (asking && !waitedOut) return waitDots(ctx, step);
  if (!ctx.tempo || !sniperDraws(ctx, step)) return <PassBy onPass={() => ctx.forwardFrom(step)} />;
  return (
    <TempoOrKept kept={kept}>
      <WalkTempo
        testId={testId(step)}
        stretch={ctx.tempo}
        onDone={() => ctx.forwardFrom(step)}
        onClose={ctx.close}
        onEvent={(event) => {
          // Skip on the Sniper as the fix: the walk's answer opens what
          // comes next and lands there, as the other fixes' does (N440;
          // was drawn at once inside the game). The chat says it from the
          // event, so the answer itself posts nothing. A game left by ✕
          // gets no answer.
          if (step.one && event.kind === "ended" && event.skipped && !event.left) ctx.answer(step, "skip");
          ctx.onTempo?.(event, step.one === true);
        }}
        one={step.one === true}
        mark={tempoMark(ctx, step)}
      />
    </TempoOrKept>
  );
}

/** A game the walk already played, drawn from nothing (the walk opened
 *  further on, or its leaving copy), has no tries of its own: it shows the
 *  game as the chat kept it, so the practice stays in the walk (B5;
 *  founder 2026-10-28: "It feels like the practice is gone from the
 *  feedback walk"). The game the walk stands on is always the live one. */
function TempoOrKept({ kept, children }: { kept: ReactNode; children: ReactNode }) {
  const past = useMountedAsPast();
  return <>{past && kept ? kept : children}</>;
}

/** The step's screen while what it shows is on its way: the typing dots,
 *  the walk's one wait (B8). */
function waitDots(ctx: ScreenCtx, step: WalkStep): ReactNode {
  return (
    <WalkOverlay testId={testId(step)} onClose={ctx.close}>
      <WalkLoading />
    </WalkOverlay>
  );
}

/** A step with nothing to show moves the walk on once drawn. */
function PassBy({ onPass }: { onPass: () => void }) {
  const past = useMountedAsPast();
  // What opens its part (the walk's reply to Skip) lands first (N440).
  const held = useWalkHeld();
  const pass = useRef(onPass);
  pass.current = onPass;
  useEffect(() => {
    if (!past && !held) pass.current();
  }, [past, held]);
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
  if (step.key === "words") return <Words ctx={ctx as ScreenCtx} step={step} />;
  if (step.key === "done") return Done(ctx, step);
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  if (!moment) return null;
  if (step.key === "coach") return CoachAnswer(ctx, step, moment);
  if (step.key === "praise") return step.one ? Best(ctx, step, moment) : Praise(ctx, step, moment);
  if (step.key === "helpers") return Helpers(ctx, step, moment);
  if (step.key === "clearer") return step.one ? OneClearer(ctx, step, moment) : Clearer(ctx, step, moment);
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
    quotes: ctx.quotes,
    ...ctx.practise,
  };
  return threadStart(ctx.walk.plan, ctx.at(step)) >= 0 ? Thread(ctx, step, moment, practiseCtx) : null;
}

/** The small line that opens a part: the step's name, as the bar says it.
 *  Other speakers name each of their moments themselves (WalkOthers). The
 *  helper words take the bar the fix's step showed: the slide of the moment
 *  whose paragraph takes them (the fix's, or their best's with no fix,
 *  N374), the tempo step's with the Sniper; "Lesson done." keeps it, as the
 *  prototype's carry() does (dots(3)). Until 2026-11-03 they had none, so at
 *  the end the bar kept the last mark, "Other speakers" from Take 2. */
function partLabel(ctx: ScreenCtx, step: WalkStep): string | null {
  if (step.key === "coachnote") return COPY.titleCoach;
  if (step.key === "summary") return ctx.takeIndex != null ? `${COPY.historyTake} ${ctx.takeIndex}` : COPY.historyTake;
  if (step.key === "words") {
    const of = step.of == null ? undefined : ctx.walk.moments[step.of];
    if (of) return slideName(of);
    const sniper = ctx.walk.plan.find((s) => s.key === "tempo");
    if (!sniper) return null;
    // The slide the words came from (B6): the stretch's when they are the
    // Sniper's, live or played again; else their best's, as with no fix.
    if (!sniper.one || ctx.fixWords(step)?.sniper) return tempoMark(ctx, step);
    const best = ctx.walk.plan.find((s) => s.one && s.key === "praise");
    const bestMoment = best?.moment == null ? undefined : ctx.walk.moments[best.moment];
    return bestMoment ? slideName(bestMoment) : null;
  }
  if (step.key === "others" || step.key === "done") return null;
  if (step.key === "tempo") return step.one && !sniperDraws(ctx, step) ? null : tempoMark(ctx, step);
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  return moment ? (stepNav(ctx, step, moment).position ?? null) : null;
}

/** The Sniper's name in the bar: as the One thing walk's fix, its slide
 *  (backend N435 item 7); otherwise, or with no slide found, "Tempo". */
function tempoMark(ctx: ScreenCtx, step: WalkStep): string {
  return (step.one && ctx.tempoSlide) || TEMPO_COPY.mark;
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
    if (step.one) return given === "keep" ? ONE_THING_COPY.keepMine : given === "accept" ? ONE_THING_COPY.tryIt : null;
    if (given === "keep") return COPY.linkKeepMyWords;
    if (given === "accept") return step.kind === "accept" ? WALK_COPY.clearerAccept : COPY.pillAcceptPractise;
    return null;
  }
  return answerBody(step, given);
}

/** The step whose answer a part of the thread shows: the part's own, or in
 *  a practise thread (`start` >= 0) the latest step up to `at` that was
 *  answered. Pure. */
function answeredIn(ctx: ScreenCtx, start: number, at: number): WalkStep {
  const plan = ctx.walk.plan;
  if (start < 0) return plan[at];
  for (let j = at; j >= start; j -= 1) if (ctx.answered(plan[j]) !== null) return plan[j];
  return plan[at];
}

/** The thread: each step reached up to `head`, opened by its name when it
 *  changes, with the speaker's choice under it. The part holding `at`, the
 *  step the walk stands on, is marked: its buttons are the dock and
 *  WalkThread brings it to the top; the parts before and after it are there
 *  to scroll (founder 2026-10-21). The last part is the newest: first drawn
 *  as the step the walk stands on, its bubbles land one by one. A new
 *  opening (`seq`) draws the parts afresh.
 *
 *  Every part sits in the same wrapper, the mark an attribute on it, so a
 *  part the walk moves off stays as it was drawn (B5). Until 2026-10-28 only
 *  the standing part had the wrapper, so moving on drew the part again from
 *  nothing: the tempo game kept only its opening lines, down to "Find a quiet
 *  spot first.", and other speakers' moments went from the thread (founder
 *  2026-10-28: "I click next and it's gone"). */
function renderThread<R>(
  ctx: ScreenCtx<R>,
  head: number,
  seq: number | null,
  backFromPractise: () => void,
  at: number,
  /** What the first part opens with, before anything of its own: the
   *  walk's hello and Last time (walkTop). */
  top: readonly ReactNode[] = [],
): ReactNode {
  const parts = walkThreadParts(ctx.walk.plan, head);
  const standing = parts.findIndex((p) => p.at >= at);
  const now = standing >= 0 ? standing : parts.length - 1;
  let last: string | null = null;
  // The One thing walk: the bar names the slide, the thread does not, and
  // the speaker's taps add no bubble (backend N435 items 1 and 2).
  const oneWalk = ctx.walk.plan.some((s) => s.one);
  // The speaker's answer to a step and the walk's reply to it (N405) open
  // the next part, so they land before its bubbles, one at a time; under
  // the last part they close it (backend N440; until then they showed at
  // once, with the next part's bubbles).
  const answers = parts.map((part) => {
    const step = ctx.walk.plan[part.at];
    const start = threadStart(ctx.walk.plan, part.at);
    // A practise thread is drawn at its last step, which can be a try only
    // planned (after "Close. Once more.") or one a Skip on its opener passed
    // by: the speaker's answer is the thread's latest one, so a Skip given
    // there still shows (N405, N440).
    const by = answeredIn(ctx, start, part.at);
    // The One thing walk adds no bubble for the speaker's tap (N435 item 2).
    const said = by.one ? null : answerSaid(ctx, by);
    // The walk's answer to Skip on the One thing walk's fix (N405); the
    // Sniper's lands here too (N440), while the chat says it from the
    // game's own event, so it is not in skipReply.
    const reply =
      skipReply(by, ctx.answered(by)) ??
      (by.one && by.key === "tempo" && ctx.answered(by) === "skip" ? ONE_THING_COPY.skipped : null);
    return [
      said ? (
        <WalkSpeakerBubble key="said" edited={wordsEdited(ctx, step)}>
          {said}
        </WalkSpeakerBubble>
      ) : null,
      reply ? (
        <WalkMessage key="reply">
          <span data-walk-skip-reply>{reply}</span>
        </WalkMessage>
      ) : null,
    ].filter(Boolean);
  });
  return parts.map((part, i) => {
    const step = ctx.walk.plan[part.at];
    const label = partLabel(ctx, step);
    const mark = label && label !== last ? <WalkThreadMark key="mark" label={label} quiet={oneWalk} /> : null;
    last = step.key === "others" ? null : (label ?? last);
    const start = threadStart(ctx.walk.plan, part.at);
    const lead = momentLead(ctx.walk.plan, start >= 0 ? start : part.at);
    const opener = ctx.walk.plan[start >= 0 ? start : part.at];
    // "And here's one moment to try another way:" above the One thing walk's fix (N309).
    // Never over a Sniper that draws nothing (C2, T).
    const one = opener?.one === true && FIX_OPENERS.has(opener.key) && (opener.key !== "tempo" || sniperDraws(ctx, opener));
    const opening = [
      ...(i === 0 ? top : []),
      ...(i > 0 ? answers[i - 1] : []),
      lead ? (
        <div key="lead" data-walk-lead={lead} className="contents">
          <WalkMessage>
            <span>{leadLine(lead)}</span>
          </WalkMessage>
        </div>
      ) : null,
      one ? (
        <div key="one" data-walk-one className="contents">
          <WalkMessage>
            <span>{ONE_THING_COPY.one}</span>
          </WalkMessage>
        </div>
      ) : null,
      // A good Take: no fix, so it says so where the fix would be (N551).
      opener?.clear ? (
        <div key="clear" data-walk-clear className="contents">
          <WalkMessage>
            <span>{ONE_THING_COPY.nothingToFix}</span>
          </WalkMessage>
        </div>
      ) : null,
      mark,
    ].filter(Boolean);
    return (
      <div key={`${seq ?? 0}:${part.key}`} data-walk-now={i === now ? "" : undefined} className="contents">
        <WalkPart now={i === now} fresh={i === parts.length - 1} opening={opening}>
          {renderScreen(ctx, step, backFromPractise)}
        </WalkPart>
        {i === parts.length - 1 ? answers[i] : null}
      </div>
    );
  });
}
