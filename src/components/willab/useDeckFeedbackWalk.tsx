"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { postReviewSummaryText } from "@/services/api/reviewSummaryText";
import { readAiVoiceOnce } from "@/services/api/aiVoice";
import { useLoungeThreadMaybe } from "./LoungeThreadContext";
import { aiVoiceChat, answerBody, coachNoteToChat, fixClipsIn, helperWordsSaid, lastFixTip, momentChat, othersAnswered, othersChat, othersLevelFor, othersOneChat, praiseChat, shownStep, skipReply, sniperWords, storedSummaryOf, tempoSaidIn, walkStepDraft, wordsEditedIn, wordsPickedIn, type WalkAuthor, type WalkThreadEntry } from "@/lib/willab/walkThread";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { WalkIntervention, WalkStep } from "@/lib/willab/walkPlan";
import { tipSaid, type WalkBankKey } from "@/lib/willab/walkLines";
import type { WalkDir } from "@/lib/willab/walkMotion";
import type { FeedbackWalkModel, FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import FeedbackWalk, { type FeedbackWalkHelperWords, type FeedbackWalkLastTime, type FeedbackWalkRequest, type FeedbackWalkTempoWords, type WalkAiShown } from "./walk/FeedbackWalk";
import type { WalkJudgementSave } from "./walk/useWalkJudging";
import { useWalkJournalPost } from "./useWalkJournalPost";
import { noteOwnAnswer, ownAnswersOf } from "./paragraphSheetData";
import { recordedSince } from "./afterTake";
import { prefetchOtherClips } from "@/services/api/otherSpeakers";
import type { OwnerAnswer } from "@/services/api/bookmarkHistory";
import { CHUNK_SHEET_COPY, ONE_THING_COPY, WALK_COPY } from "./idealEditCopy";
import {
  acceptRewriteBehind,
  helperWordsBehind,
  helperWordsFromPracticeBehind,
  keepWordsBehind,
  type SaveBehind,
} from "./saveBehind";
import { answerChanged, latestAnswerOf, reopensJudgement } from "@/lib/willab/changeJudgement";
import { isConfidentVoiceFeedback, judgedStatus } from "@/lib/willab/chunkSteps";
import {
  buildFeedbackReplay,
  buildFeedbackWalk,
  walkHelpersForPart,
  walkStart,
  walkStepForPart,
  walkAsItStands,
  walkLastStep,
  walkStepAt,
  walkThreadEnd,
  type WalkMomentEnd,
  type WalkStepTarget,
  type FeedbackWalkItem,
  type FeedbackWalkItemExercise,
  type ReplayTries,
} from "@/lib/willab/feedbackWalkModel";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import type { PractiseCard } from "@/lib/willab/paragraphOverlay";
import { clearerPieces } from "@/lib/willab/clearerPieces";
import { PLAN_COPY, levelNameOf } from "@/lib/willab/planCopy";
import { phraseSelection, quoteSpan } from "@/lib/willab/phraseTokens";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { PRAISE_LEAD, praiseLines } from "@/lib/willab/trackedChangeWhy";
import { practiseOfferedNow, readPractiseOffered } from "@/services/api/consentChoices";
import type { CoachMessage, DocumentSuggestion } from "@/services/api/idealText";
import { suggestionSource, walkPractiseIO } from "@/services/api/walkPractise";
import { fetchConfidencePractice } from "@/services/api/confidentVoicePractice";
import { practiceTries, threadTries } from "@/lib/willab/walkTries";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { reportMomentEvent, type MomentShown } from "@/services/api/momentEvents";
import { lineBankIO } from "@/services/api/lineBank";
import {
  markCoachFeedbackSeen,
  shownKey,
  type CoachFeedbackShown,
} from "@/services/api/coachFeedbackSeen";
import { setHelperWordsFromPractice, type RootPhraseSpan } from "@/services/api/partLock";
import { fetchLastFix, type LastFix } from "@/services/api/reviewLastFix";
import type { LockResult } from "./DeckChunkModal";
import { praiseTitleFor } from "@/lib/willab/praiseLevels";
import { useGreenReasons } from "./walk/useGreenReasons";
import { fetchUserProfileShared } from "@/services/api/userProfile";
import type { WalkPraiseReasons } from "@/lib/willab/praiseReason";
import { useReviewTempo } from "./walk/useReviewTempo";
import { postTempoGame } from "@/services/api/reviewTempo";
import { askWalkQuote, replayWalkQuote, setWalkQuote, walkQuoteShown } from "@/services/api/walkQuote";
import type { WalkQuoteIO } from "./walk/useWalkQuote";
import { TEMPO_COPY, afterTry, oneThingTempoLines, stretchWordsIn, tempoOpening, type TempoEvent, type TempoStretch } from "@/lib/willab/tempoStep";

/* -------------------------------------------------------------------------- */
/*  The Feedback walk on the Ideal Text page (build plan D-FW-14; made        */
/*  permanent by the founder 2026-10-11, "keep the new designs, make them     */
/*  permanent").                                                              */
/*                                                                            */
/*  The deck asks these questions and draws one element:                      */
/*    review()      "Review feedback" was tapped: open the walk on its first   */
/*                  screen (the coach's note, else the first praise). False   */
/*                  when this phase has nothing to show, and the deck goes on */
/*                  with its own sheets.                                      */
/*    tapPart(id)   a paragraph with an open moment was tapped: its own steps */
/*                  only, opened on what it asks; once answered, back on the  */
/*                  Ideal Text (founder 2026-10-20). False otherwise.         */
/*    replayPart(id) a paragraph whose moments are answered was tapped, or   */
/*                  its orange words: the whole finished walk to scroll       */
/*                  through, at the step it answered, with no buttons         */
/*                  (founder 2026-10-20). False when it has no moment, and    */
/*                  the deck opens the paragraph's own sheet.                 */
/*    waits(id)     the paragraph still has a step to answer: its black line. */
/*    practisePart(id, card, moment) Practise on a paragraph's own sheet: the */
/*                  walk's practise screens on that card (founder 2026-10-10, */
/*                  "the practise screens should be the same in all cases").  */
/*                  False when the card has no snippet and evidence to open a */
/*                  practice on; the sheet then shows no Practise.            */
/*    element       the walk itself.                                          */
/*                                                                            */
/*  Its own hook so the deck gains a line, not a branch (the complexity       */
/*  ratchet).                                                                 */
/*                                                                            */
/*  Helper words picked in the walk are saved through the very path the       */
/*  paragraph sheet uses: the deck's setRootPhrase and lock, behind the       */
/*  screen (`helperWordsBehind` under `saveBehind`). A clearer version's      */
/*  decision goes through the Feedback sheet's lanes, behind the screen too: */
/*  "Accept and practise" the speaker's response then the deck's onAccept    */
/*  (`acceptRewriteBehind`, L1: the speaker's decision), "Keep my words" the */
/*  response then the deck's onKeepMine (`keepWordsBehind`). The crossed-out */
/*  and orange words are the served rewrite's own `quote` and `proposedText`.*/
/*                                                                            */
/*  The practise (D-FW-16) is opened on the served item's own snippet and     */
/*  evidence (walkPractiseIO), the same routes today's practise sheet uses.   */
/*  An exercise (D-FW-17) is the served offer the Feedback sheet's Exercise   */
/*  step plays: its video (the coach's, else the library's), its instruction  */
/*  and its words (`exerciseOf`).                                             */
/*                                                                            */
/*  The judgements (D-FW-18) are saved as the Feedback sheet saves them: the  */
/*  speaker's own answer on the Confident Voice item (L3), through the        */
/*  feedback-response route, behind the screen; a changed answer is saved     */
/*  beside the first (200 `revised`, QA1 A) and the same answer sends nothing */
/*  (`judgementBehind`). Its bar leaves the page at once (`onJudged`). Skip   */
/*  on "Judgement time!" settles every unanswered moment as the paragraph     */
/*  sheet's Skip does: a `skipped` moment event (0408), and the bar leaves at */
/*  once. The Journal post the intro links to is the published self-modeling */
/*  post (JP1 A).                                                             */
/* -------------------------------------------------------------------------- */

type SlideGroup = { slideIndex: number | null; chunks: readonly DeckChunk[] };

/** The praise words an item already carries: its signed line (35f), else
 *  the sheet's own lead and the line per cue it names (the same words the
 *  Feedback sheet shows). Only on a praise; never made up. */
export function praiseWordsOf(item: DocumentSuggestion): string[] {
  if (item.praiseLine) return [item.praiseLine];
  return [...praiseLeadOf(item), ...praiseLines(item.cueKeys ?? [])];
}

/** The praise's own line without the cue sentences: what the first bubble
 *  says when GPT's reason explains the moment below it (founder
 *  2026-10-18). Pure. */
export function praiseLeadOf(item: DocumentSuggestion): string[] {
  if (item.praiseLine) return [item.praiseLine];
  return [item.tentative ? CHUNK_SHEET_COPY.praiseTentative : PRAISE_LEAD];
}

function slideOf(groups: readonly SlideGroup[], partId: string): number | null {
  const group = groups.find((g) => g.chunks.some((c) => c.part.id === partId));
  return group ? group.slideIndex : null;
}

/** The Take's open feedback, as the walk reads it: every item still waiting
 *  on a paragraph whose bar is up, and a moment's Clearer version already
 *  decided while the moment itself still waits (the walk closed during its
 *  try and opened again keeps its Clearer version, never the AI clip in its
 *  place, N381). Pure. */
export function deckWalkItems(
  chunks: readonly DeckChunk[],
  groups: readonly SlideGroup[],
  waiting: (chunk: DeckChunk) => boolean,
  pendingOf: (chunk: DeckChunk) => readonly DocumentSuggestion[],
  slideLabel: (partId: string) => string | null,
  slideTitle?: (partId: string) => string | null,
  answeredOf?: (chunk: DeckChunk) => readonly DocumentSuggestion[],
): FeedbackWalkItem<DocumentSuggestion>[] {
  const seen = new Set<string>();
  const out: FeedbackWalkItem<DocumentSuggestion>[] = [];
  for (const chunk of chunks) {
    const partId = chunk.part.id;
    if (seen.has(partId) || !waiting(chunk)) continue;
    seen.add(partId);
    const slide = slideOf(groups, partId) ?? 0;
    const open = pendingOf(chunk);
    const blocks = new Set(open.map((item) => item.blockId).filter(Boolean));
    const decided = (answeredOf?.(chunk) ?? []).filter(
      (item) => item.blockId && blocks.has(item.blockId) && rewriteOf(item) !== null && !open.some((o) => o.id === item.id),
    );
    for (const item of [...open, ...decided]) out.push(walkItemOf(item, chunk, slide, slideLabel(partId), slideTitle?.(partId) ?? null));
  }
  return out;
}

/** The Take's feedback once the walk is finished, as the replay reads it
 *  (Q-IT643b A): every item on every paragraph, waiting or answered, in
 *  page order. The replay keeps a judgement only where the speaker gave an
 *  answer (buildFeedbackReplay). Pure. */
export function deckReplayItems(
  chunks: readonly DeckChunk[],
  groups: readonly SlideGroup[],
  itemsOf: (chunk: DeckChunk) => readonly DocumentSuggestion[],
  slideLabel: (partId: string) => string | null,
  slideTitle?: (partId: string) => string | null,
): FeedbackWalkItem<DocumentSuggestion>[] {
  const seenParts = new Set<string>();
  const seenItems = new Set<string>();
  const out: FeedbackWalkItem<DocumentSuggestion>[] = [];
  for (const chunk of chunks) {
    const partId = chunk.part.id;
    if (seenParts.has(partId)) continue;
    seenParts.add(partId);
    const slide = slideOf(groups, partId) ?? 0;
    for (const item of itemsOf(chunk)) {
      if (seenItems.has(item.id)) continue;
      seenItems.add(item.id);
      out.push(walkItemOf(item, chunk, slide, slideLabel(partId), slideTitle?.(partId) ?? null));
    }
  }
  return out;
}

/** Where the Sniper's stretch is said (N309 item 3, N435 item 7): on its
 *  slide when the answer names it (C-TEMPO), the paragraph that says its
 *  words, matched leniently (case, punctuation, hesitations), with those
 *  words as the paragraph shows them; else the slide's first paragraph,
 *  with no words. Null when neither is found. Pure. */
function stretchParagraph(
  tempo: TempoStretch | null | undefined,
  chunks: readonly DeckChunk[],
  groups: readonly SlideGroup[],
): { chunk: DeckChunk; words: string | null } | null {
  const stretch = tempo?.said.stretch.trim();
  if (!tempo || !stretch) return null;
  const slide = tempo.slideIndex != null ? groups.find((g) => g.slideIndex === tempo.slideIndex) : undefined;
  for (const chunk of slide ? slide.chunks : chunks) {
    const words = stretchWordsIn(chunk.part.text, stretch);
    if (words) return { chunk, words };
  }
  return slide?.chunks[0] ? { chunk: slide.chunks[0], words: null } : null;
}

/** The stretch's clip as the chat keeps a moment's (momentChat): its
 *  recording's id, so Will's question finds its words (E2), and its signed
 *  link when there is one. Null without a recording. Pure. */
function stretchClipChat(tempo: TempoStretch): Record<string, unknown> | null {
  const snippet = tempo.snippetId ?? tempo.clip?.snippetId ?? null;
  if (!snippet) return null;
  const clip = tempo.clip ?? null;
  return { snippet_id: snippet, src: clip?.src ?? null, start_ms: clip?.startOffsetMs ?? null, duration_ms: clip?.durationMs ?? null, words: null };
}

/** The practices the walk adds (N166): the tempo step on the Take's
 *  stretch. The One thing walk served with no choice of its fix (older
 *  payloads) offers the Sniper only where the stretch can be it: a rushed
 *  one, or the plan's pace or pause week (`planLevel`, served only for
 *  those); a slow stretch off such a week leaves the fix a moment (T, N323
 *  item 6). A Take served before N289 keeps its tempo step on any stretch.
 *  Pure. */
function tempoOffered(
  tempo: TempoStretch | null | undefined,
  items: readonly FeedbackWalkItem<DocumentSuggestion>[],
): readonly WalkIntervention[] {
  if (!tempo) return [];
  const oneWalk = items.some((i) => i.walkSlot);
  return !oneWalk || tempo.reading === "rushed" || tempo.planLevel != null ? ["tempo"] : [];
}

/** Whether the walk can open whole (A2, B5, C0, C0a, T): the speaker's name
 *  read; Last time read, its tip served or the chat that keeps it loaded;
 *  and the tempo answer in where the Sniper may be the fix (the server chose
 *  it, or served no choice). Pure. */
function walkOpens(at: {
  items: readonly FeedbackWalkItem<DocumentSuggestion>[];
  tempo: TempoStretch | null | undefined;
  nameRead: boolean;
  lastAnswered: boolean;
  lastFix: LastFix | null;
  thread: { loading: boolean } | null;
}): boolean {
  const served = at.items.find((i) => i.oneFix)?.oneFix ?? null;
  const tempoIn = at.tempo !== undefined || (served !== null && served !== "tempo");
  // A tip the server did not send is looked up in the chat: once it loaded.
  const lastIn = at.lastAnswered && (!at.lastFix || Boolean(at.lastFix.tip) || !at.thread?.loading);
  return at.nameRead && lastIn && tempoIn;
}

/** LAST TIME (founder 2026-10-31, N309 item 1): the last Take's fix, when
 *  it rose on this Take, read once per Take from Take 2, the speaker's own
 *  walk only; `answered` once read, or with nothing to read. */
function useLastFix(
  arcId: string | null | undefined,
  take: string | null,
  coachOnly: boolean,
  takeIndex: number | null | undefined,
): { fix: LastFix | null; answered: boolean } {
  const key = arcId && take && !coachOnly && (takeIndex ?? 0) >= 2 ? `${arcId}:${take}` : null;
  const [read, setRead] = useState<{ key: string; fix: LastFix | null } | null>(null);
  useEffect(() => {
    if (!key || !arcId || !take) return;
    let on = true;
    void fetchLastFix(arcId, take).then((fix) => {
      if (on) setRead({ key, fix });
    });
    return () => {
      on = false;
    };
  }, [key, arcId, take]);
  const answered = !key || read?.key === key;
  return { fix: key && read?.key === key ? read.fix : null, answered };
}

/** A green moment's reason written after the page was read says in the
 *  chat what the screen says (founder 2026-10-18). Pure. */
function withLateReason<S extends { author: WalkAuthor; body: string } | null>(
  said: S,
  step: WalkStep,
  moment: FeedbackWalkMoment<DocumentSuggestion> | null,
  reasons: WalkPraiseReasons,
): S | ReturnType<typeof praiseChat> {
  // Their best in the One thing walk says why it worked in its own line
  // (N309): no reason bubble.
  if (!said || !moment || step.key !== "praise" || step.one || moment.praiseReason) return said;
  const reason = reasons.of(moment.clip?.snippetId);
  return reason ? praiseChat(moment, reason) : said;
}

/** The screens a moment's coach answer is drawn on. */
/** How long a step tapped in the Lounge waits on the replay's reads. */
const REPLAY_WAIT_MS = 4000;
/** The longest the walk's opening waits on its name, Last time and the
 *  Sniper's answer (`walkReady`): well under the wait cover's five seconds
 *  for a lens to appear and the lens's eight-second last resort. */
export const WALK_OPEN_WAIT_MS = 2_500;

const COACH_ANSWER_STEPS: ReadonlySet<string> = new Set(["coach", "praise", "clearer", "exVideo"]);
/** The screens a level's moment opens its practise on (G7, N209). */
const LEVEL_STEPS: ReadonlySet<string> = new Set(["clearer", "exVideo"]);

/** The moment where this week's level shows most (G7, N209): the chat
 *  posts the level's line above its clip, as on the screen, when the step
 *  itself is said. */
function postLevel(
  post: (entry: Omit<WalkThreadEntry, "take" | "arcId">) => void,
  step: WalkStep,
  moment: FeedbackWalkMoment<DocumentSuggestion> | null,
  said: boolean,
  at: { moment: number | null; attempt: number | null; extra: Record<string, unknown> },
): void {
  if (!said || !moment?.planLevel || !LEVEL_STEPS.has(step.key)) return;
  post({ key: `level:${step.key}`, ...at, author: "app", body: PLAN_COPY.levelHere(moment.planLevel) });
}

/** The machine's answers on a try, posted as the try is made. */
const TRY_ANSWER_STEPS: ReadonlySet<string> = new Set(["improved", "encourage", "thanks"]);

/** The Sniper's rows in the chat that say it was played: a try, a Skip
 *  (the speaker's, or the One thing walk's answer to it), its closing line.
 *  Its opening (the stretch's clip and line) is posted as the game opens,
 *  before any of them. */
const TEMPO_PLAYED_STEPS: ReadonlySet<string> = new Set(["tempo:try", "tempo:skip", "tempo:skipped", "tempo:close"]);

/** Each Take's summary ask, while it is written and once it is (C9, D4):
 *  one per Take for every deck on the page, so a page opened again while
 *  the first ask still writes never asks a second time. A failed ask is
 *  dropped, so the walk's next end asks again. */
const summaryAsks = new Map<string, Promise<string | null>>();

/** What the closing summary hears (lock 2026-10-12, section 3): the try's
 *  outcome and the last two helper words the speaker picked. */
type WalkHeard = { practice: "better" | "not_yet" | null; words: string[] };

/** One walk step heard: a try that landed is "better", and stays so; the
 *  other answers on a try are "not_yet". Pure on `heard`. */
function hear(heard: WalkHeard, step: string, author: string, body: string): void {
  if (step === "improved") heard.practice = "better";
  if ((step === "thanks" || step === "encourage") && heard.practice !== "better") heard.practice = "not_yet";
  if (author === "speaker" && (step.startsWith("words:") || step.startsWith("try-words:")) && body.trim()) {
    heard.words = [...heard.words.filter((w) => w !== body), body].slice(-2);
  }
}

/** What the loaded chat kept of `take`'s walk for its summary, by the same
 *  rules as the walk posting it, so a summary asked by a page opened later,
 *  or by a walk played again, still hears the try and the words (D2, E1). Pure. */
function heardIn(messages: readonly LoungeMessage[], take: string): WalkHeard {
  const heard: WalkHeard = { practice: null, words: [] };
  for (const m of messages) {
    if (m.kind !== "walk_step" || m.metadata?.take_session_id !== take) continue;
    hear(heard, String(m.metadata?.step ?? ""), String(m.metadata?.author ?? ""), m.body);
  }
  return heard;
}

/** How far the thread is drawn past `at` in the whole walk as it stands:
 *  through the answered steps that follow it, up to the next step that
 *  still waits or the tail. Pure. */
function answeredRun<R>(
  whole: FeedbackWalkModel<R>,
  at: number,
  waits: (moment: FeedbackWalkMoment<R>) => boolean,
): number {
  let head = at;
  for (let j = at + 1; j < whole.plan.length; j += 1) {
    const m = whole.plan[j].moment;
    const moment = m == null ? undefined : whole.moments[m];
    if (!moment || waits(moment)) break;
    head = j;
  }
  return head;
}

/** OPENED AGAIN FROM THE CHAT (founder 2026-11-06, N539, N541): only the
 *  first opening, right after the processing, goes step by step. It names
 *  no step; every door from the chat names one, so it is an opening after
 *  the first. Then what is answered is read only, as given, and what is
 *  left to do (a step never reached, a choice not made, a practise stopped
 *  midway) stands at the bottom with its own buttons; with nothing left it
 *  is a scroll ending on Close. An unseen coach word keeps its steps, so
 *  its Continue marks it seen; the page's own doors are unchanged. Pure. */
function reopenedFromChat(at: {
  lens: boolean;
  target: WalkStepTarget | null | undefined;
  coachOnly: boolean;
  coachUnseen: boolean;
}): boolean {
  return at.lens && Boolean(at.target) && !at.coachOnly && !at.coachUnseen;
}

/** Where the walk as given stands, opened at `at`. A finished walk opened
 *  from the chat (`lens`) stands on its newest step when it does not hold
 *  the step asked for (the Take alone) or holds it in its tail (the summary,
 *  which steps aside once given, so nothing stayed on screen and the page
 *  showed the text: founder 2026-10-26, "the feedback walk opens the ideal
 *  text instead of the feedback walk!"; B10). Pure. */
function standAtOf<R>(done: FeedbackWalkModel<R> | null, at: number | null, finished: boolean, lens: boolean): number | null {
  if (!done || !finished || !lens) return at;
  const newest = walkLastStep(done) ?? walkStart(done);
  return newest !== null && (at === null || at > newest) ? newest : at;
}

/** One served item as the walk reads it. Pure. */
function walkItemOf(
  item: DocumentSuggestion,
  chunk: DeckChunk,
  slide: number,
  label: string | null,
  title: string | null = null,
): FeedbackWalkItem<DocumentSuggestion> {
  const tiered = item.bookmarkTier != null;
  const green = item.bookmarkTier === "confident";
  const praise = tiered ? green : item.openCard === "praise" || item.feedbackFamily === "great_formulation";
  const exercise = exerciseOf(item);
  // The coach's clearer version is the moment's Clearer version (founder
  // 2026-10-20), ahead of the machine's.
  const rewrite = coachVersionOf(item) ?? rewriteOf(item);
  return {
    start: item.start,
    slide,
    blockId: item.blockId ?? null,
    hasRewrite: rewrite !== null,
    ...(tiered
      ? {
          tiered,
          green,
          practicePrompt: item.practicePrompt === true,
          helperWordsPrompt: item.helperWordsPrompt === true,
          // A praised moment practised with its AI clip (backend N122),
          // on Takes baked before N289.
          confidentPractice: item.confidentPractice === true,
          // The moment's job in the walk (backend N289).
          walkSlot: item.walkSlot ?? null,
          // The One thing walk's one fix, as the server chose it (C-SNIPER).
          oneFix: item.oneFix ?? null,
        }
      : {}),
    openCard: item.openCard ?? null,
    feedbackFamily: item.feedbackFamily ?? null,
    hasExercise: exercise !== null,
    partId: chunk.part.id,
    paragraphText: chunk.part.text,
    slideLabel: label,
    slideTitle: title,
    praiseWords: praise ? praiseWordsOf(item) : null,
    praiseTitle: praise ? praiseTitleFor(item.levelKey, item.id) : null,
    highest: item.highestMoment === true,
    // On a plan, the moment where this week's level shows most (G7, N209).
    planLevel: levelNameOf(item.planLevel),
    praiseLead: praise ? praiseLeadOf(item) : null,
    praiseReason: praise ? item.praiseReason ?? null : null,
    clip: item.snippetAudioRef
      ? { src: item.snippetAudioRef, startOffsetMs: item.startOffsetMs, durationMs: item.durationMs, snippetId: item.snippetId }
      : null,
    said: item.quote,
    rewrite,
    item: suggestionSource(item) ? item : null,
    exercise,
    judge: reopensJudgement(item) ? item : null,
    ...(item.coachAnswer ? { coachAnswered: true, coachAnswer: item.coachAnswer, coachItem: item } : {}),
    ...(exercise?.byCoach ? { coachExercise: true } : {}),
    ...(rewrite?.byCoach ? { coachVersion: true } : {}),
  };
}

/** The coach's answer as a clearer version: their words in place of the
 *  moment's own. Deciding it writes nothing on the text (an accepted
 *  clearer version reaches the Ideal Text only when it is said). Pure. */
export function coachVersionOf(item: DocumentSuggestion): FeedbackWalkItem<DocumentSuggestion>["rewrite"] {
  const answer = item.coachAnswer;
  if (answer?.kind !== "version" || !item.quote?.trim()) return null;
  return { quote: item.quote, proposedText: answer.text, move: null, item, decided: null, byCoach: true };
}

/** A served rewrite the walk can draw and decide: a replace with words to
 *  offer, from the clearer-version family or routed to the rewrite card.
 *  The same fields the Feedback sheet's rewrite card shows, its signed move
 *  (`rewriteMove`) among them: the line above the words to say. Pure. */
export function rewriteOf(item: DocumentSuggestion): FeedbackWalkItem<DocumentSuggestion>["rewrite"] {
  if (item.kind !== "replace" || !item.proposedText?.trim()) return null;
  if (item.feedbackFamily !== "rewrite_clarity" && item.openCard !== "rewrite") return null;
  // The decision already given (the replay shows it answered).
  const decided = item.status === "approved" ? "accept" : item.status === "dismissed" ? "keep" : null;
  return { quote: item.quote, proposedText: item.proposedText, move: item.rewriteMove, reason: item.rewriteReason ?? null, item, decided };
}

/** The exercise an item's follow-up opens on (D-FW-17): the served offer,
 *  where the follow-up matrix names the exercise card (`openCard`, N48.1)
 *  or the coach chose it (its video rides the moment when shared, 35g-2),
 *  and the item can be practised on. The video, instruction and words are
 *  the offer's own, the ones the Feedback sheet's Exercise step shows;
 *  nothing new is fetched. Pure. */
export function exerciseOf(item: DocumentSuggestion): FeedbackWalkItemExercise<DocumentSuggestion> | null {
  const offer = item.practiceExercise;
  if (!offer || !suggestionSource(item)) return null;
  if (item.openCard !== "exercise" && offer.chosenByCoach !== true && item.practicePrompt !== true) return null;
  const say = (offer.passage || item.quote || "").trim();
  if (!say) return null;
  return {
    video: offer.explanationVideoRef?.trim() || null,
    byCoach: offer.chosenByCoach === true,
    instruction: (offer.instruction ?? "").trim() || null,
    say,
    item,
  };
}

/** The span to save on the paragraph as it is now: the walk's own span when
 *  the words have not changed under it, else the same words found again;
 *  null when they cannot be found once (nothing is guessed). Pure. */
export function spanOnLiveText(save: FeedbackWalkHelperWords, liveText: string): RootPhraseSpan | null {
  if (liveText === save.paragraphText) return save.span;
  return quoteSpan(liveText, stripRichMarkers(save.span.text).trim());
}

/** One judgement from the walk, saved behind the screen as the Feedback
 *  sheet saves it: only a change from the answer given earlier in the walk
 *  is sent (QA1 A: a changed answer is saved beside the first, the server's
 *  200 `revised` is a save like any other); a Take a newer one replaced
 *  cannot be retried away. */
export async function judgementBehind(save: WalkJudgementSave<DocumentSuggestion>): Promise<"ok" | "failed" | "final"> {
  const { item, answer, earlier } = save;
  if (!item.takeSessionId) return "final";
  if (!answerChanged(earlier ? { item, answer: earlier } : null, answer)) return "ok";
  const result = await saveTakeFeedbackResponse({
    takeSessionId: item.takeSessionId,
    feedbackId: item.id,
    feedbackFamily: "confident_voice",
    response: answer,
    candidateId: item.candidateId,
    feedbackMembershipId: item.feedbackMembershipId,
    feedbackExposureId: item.feedbackExposureId,
  });
  if (result.ok) return "ok";
  return result.reason === "superseded" ? "final" : "failed";
}

/** Skip on "Judgement time!": each moment settled as skipped, once per
 *  bookmark (the paragraph sheet's Skip, useFeedbackFirst). */
export function skipJudgements(
  items: readonly DocumentSuggestion[],
  settle: (item: DocumentSuggestion) => void,
): void {
  const told = new Set<string>();
  for (const item of items) {
    const snippetId = item.snippetId;
    if (snippetId && !told.has(snippetId)) {
      told.add(snippetId);
      void reportMomentEvent(snippetId, "skipped");
    }
    settle(item);
  }
}

/** A moment the walk went past (founder 2026-10-21), settled at once as the
 *  server settles it on its next read: approved on a Good job or helper
 *  words used, else dismissed. One the machine did not close and no helper
 *  words saved is told to the server as skipped, the paragraph sheet's
 *  Skip, so a reload agrees. */
function settleWalked(
  items: readonly DocumentSuggestion[],
  end: WalkMomentEnd,
  wordsUsed: boolean,
  settle: (item: DocumentSuggestion, status: "approved" | "dismissed") => void,
): void {
  const status = end === "good_job" || wordsUsed ? "approved" : "dismissed";
  if (end === "passed" && !wordsUsed) skipJudgements(items, (item) => settle(item, status));
  else for (const item of items) settle(item, status);
}

/** The practice an item's exercise was opened on, when the server named
 *  one (its tries are read by it); null: none yet. Pure. */
function practiceIdOf(item: FeedbackWalkItem<DocumentSuggestion>): string | null {
  const served = item.exercise?.item ?? item.item ?? item.rewrite?.item ?? null;
  return served?.practiceExercise?.practiceId ?? null;
}

/** The practice a moment's practise was opened on, from the items it
 *  carries. Pure. */
function momentPracticeId(moment: FeedbackWalkMoment<DocumentSuggestion>): string | null {
  const served = moment.exercise?.item ?? moment.practiseItem ?? moment.clearer?.item ?? null;
  return served?.practiceExercise?.practiceId ?? null;
}

/** The Take the walk reviews: the one its feedback items were served on,
 *  else the page's. Pure. */
export function reviewedTake(
  items: readonly FeedbackWalkItem<DocumentSuggestion>[],
  pageTake: string | null,
): string | null {
  for (const i of items) {
    const take = i.judge?.takeSessionId ?? i.item?.takeSessionId ?? i.rewrite?.item.takeSessionId;
    if (take) return take;
  }
  return pageTake;
}


/** What a walk screen showed of the coach's work, for the Lounge's "new"
 *  (D-FW-19; backend 0439): on a moment's screen, the moment itself, once
 *  per snippet, from every item the moment carries and every item still
 *  open on its paragraphs. The coach's word for the Take is not told on
 *  show: only its Continue marks it watched (founder 2026-10-19, N80; ✕
 *  keeps the ring). Pure. */
export function coachShownOn(
  step: WalkStep,
  moment: FeedbackWalkMoment<DocumentSuggestion> | null,
  openOn: readonly DocumentSuggestion[] = [],
): CoachFeedbackShown[] {
  if (step.key === "coachnote" || !moment) return [];
  const items = [
    moment.judgeItem,
    moment.practiseItem,
    moment.clearer?.item,
    moment.exercise?.item,
    moment.coachItem,
    ...openOn,
  ];
  const out = new Map<string, CoachFeedbackShown>();
  for (const item of items) {
    if (!item?.takeSessionId || !item.snippetId) continue;
    const shown = { takeSessionId: item.takeSessionId, snippetId: item.snippetId };
    out.set(shownKey(shown), shown);
  }
  return [...out.values()];
}

/** The coach's word as its chat bubble: "Your coach" over the words, and
 *  their video as a thumb in it (prototype v31). Pure. */
function coachNoteChat(said: ReturnType<typeof shownStep>, coach: CoachMessage | null): ReturnType<typeof shownStep> {
  if (!coach?.videoUrl) return said;
  return { author: "coach", body: said?.body ?? CHUNK_SHEET_COPY.titleCoach, extra: { video: coach.videoUrl } };
}

/** The coach's word for the chat, or null when the chat must not get a
 *  copy (coachNoteToChat: once per Take, not in a replay, not while the chat
 *  loads). Pure. */
function coachNoteOnce(
  said: ReturnType<typeof shownStep>,
  coach: CoachMessage | null,
  at: { thread: Parameters<typeof coachNoteToChat>[0]; take: string | null },
  replay: boolean,
): ReturnType<typeof shownStep> {
  return coachNoteToChat(at.thread, at.take, coach?.takeSessionId ?? null, replay) ? coachNoteChat(said, coach) : null;
}

/** What each moment screen of the walk has on it, as the paragraph sheet
 *  reported it (0408). */
const OPENED_AS: Readonly<Record<string, MomentShown>> = {
  praise: "praise",
  clearer: "rewrite",
  exVideo: "exercise",
  coach: "coach_answer",
};

/** The moments a walk screen shows, as the "opened" record the coach's
 *  queue reads (N48.2): without it no coach ever hears a walked moment
 *  (founder 2026-10-20). One entry per clip, with what was on screen. Pure. */
export function momentsOpenedOn(
  step: WalkStep,
  moment: FeedbackWalkMoment<DocumentSuggestion> | null,
  openOn: readonly DocumentSuggestion[] = [],
): { snippetId: string; shown: MomentShown[] }[] {
  const kind = OPENED_AS[step.key];
  if (!kind) return [];
  const shown: MomentShown[] = moment?.coachAnswer && kind !== "coach_answer" ? [kind, "coach_answer"] : [kind];
  return coachShownOn(step, moment, openOn).map((s) => ({ snippetId: s.snippetId!, shown }));
}

/** What one walk screen tells the server, once per opening of the walk:
 *  the coach's feedback it showed (D-FW-19), and the moments that reached
 *  the speaker, the record that lists them for a coach (founder 2026-10-20). */
function tellShown(
  told: Set<string>,
  step: WalkStep,
  moment: FeedbackWalkMoment<DocumentSuggestion> | null,
  openOn: readonly DocumentSuggestion[],
): void {
  const once = (key: string) => !told.has(key) && Boolean(told.add(key));
  for (const shown of coachShownOn(step, moment, openOn)) {
    if (once(shownKey(shown))) void markCoachFeedbackSeen(shown);
  }
  for (const opened of momentsOpenedOn(step, moment, openOn)) {
    if (once(`opened:${opened.snippetId}`)) void reportMomentEvent(opened.snippetId, "opened", opened.shown);
  }
}

/** Personalised practice, as the speaker set it. */
function usePracticeOn(): boolean {
  const [offered, setOffered] = useState<boolean>(() => practiseOfferedNow() ?? true);
  useEffect(() => {
    let live = true;
    void readPractiseOffered().then((value) => {
      if (live) setOffered(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return offered;
}

/** The item a paragraph's practise is opened on: the card's own item when it
 *  carries its snippet and evidence, else the card's item on the moment's
 *  snippet and evidence (as the paragraph's practise always opened it: the
 *  moment's clip, the card's feedback). Null when neither carries them. */
function practiseSourceOf(
  item: DocumentSuggestion | null,
  moment: DocumentSuggestion | null,
): DocumentSuggestion | null {
  const own = item ?? moment;
  if (!own) return null;
  if (suggestionSource(own)) return own;
  if (!moment?.snippetId || !moment.evidence) return null;
  return { ...own, snippetId: moment.snippetId, evidence: moment.evidence };
}

/** A paragraph's practise as the walk draws it (founder 2026-10-10, "the
 *  practise screens should be the same in all cases"): the card on the
 *  paragraph's own sheet, as one moment of the walk, opened at its practise.
 *  A clearer version practises its words, an exercise its passage under its
 *  instruction, a praise or the plain moment the moment said again. Null
 *  when there is nothing to open a practice on (no snippet and evidence), or
 *  an exercise whose offer is gone. Pure. */
export function paragraphPractise(args: {
  card: PractiseCard;
  /** The paragraph's Confident Voice item: its clip, its snippet. */
  moment: DocumentSuggestion | null;
  partId: string;
  paragraphText: string;
  slideLabel: string | null;
}): FeedbackWalkModel<DocumentSuggestion> | null {
  const { card, moment, partId, paragraphText, slideLabel } = args;
  const source = practiseSourceOf(card.item, moment);
  if (!source) return null;
  const clip = moment?.snippetAudioRef
    ? { src: moment.snippetAudioRef, startOffsetMs: moment.startOffsetMs, durationMs: moment.durationMs, snippetId: moment.snippetId }
    : null;
  const base: FeedbackWalkMoment<DocumentSuggestion> = {
    index: 0,
    partId,
    paragraphText,
    slideLabel,
    praiseWords: [],
    clip,
    clearer: null,
    practiseItem: source,
    exercise: null,
    judgeItem: null,
  };
  let one: FeedbackWalkMoment<DocumentSuggestion> = base;
  let kind: WalkStep["kind"] = "moment";
  if (card.kind === "exercise") {
    if (!source.practiceExercise || !card.passage.trim()) return null;
    one = {
      ...base,
      exercise: {
        video: card.video,
        byCoach: source.practiceExercise.chosenByCoach === true,
        instruction: card.instruction,
        say: card.passage,
        item: source,
      },
    };
    kind = "instruction";
  } else if (card.kind === "rewrite") {
    const pieces = clearerPieces(card.item.quote, card.text) ?? { before: [], after: [] };
    one = {
      ...base,
      clearer: {
        ...pieces,
        say: card.text,
        said: card.item.quote,
        coachLine: card.move?.trim() || null,
        decided: null,
        item: source,
      },
    };
    kind = "words";
  }
  return {
    plan: [
      { key: "page", overlay: false },
      { key: "practise", moment: 0, slide: 0, kind, attempt: 1 },
      { key: "end", overlay: false },
    ],
    moments: [one],
    partsOf: [[partId]],
  };
}

/** One paragraph's helper-words step on its own (lock 2026-10-12, section
 *  4): what a tap on orange helper words opens when this Take's walk has no
 *  such step for the paragraph (no moment on it, or the walk is done and no
 *  replay holds it). The saved words open picked, with "Keep these"
 *  (helper-words lock B10). Pure. */
export function paragraphHelpers(args: {
  partId: string;
  paragraphText: string;
  slideLabel: string | null;
  /** The helper words saved on the paragraph; null: none. */
  helperWords?: string | null;
}): FeedbackWalkModel<DocumentSuggestion> {
  const { partId, paragraphText, slideLabel } = args;
  const saved = phraseSelection(paragraphText, args.helperWords ?? null);
  return {
    replay: { picks: saved ? { 0: saved } : {}, answers: {} },
    plan: [
      { key: "page", overlay: false },
      { key: "helpers", moment: 0, slide: 0 },
      { key: "end", overlay: false },
    ],
    moments: [
      {
        index: 0,
        partId,
        paragraphText,
        slideLabel,
        praiseWords: [],
        clip: null,
        clearer: null,
        practiseItem: null,
        exercise: null,
        judgeItem: null,
      },
    ],
    partsOf: [[partId]],
  };
}

export function useDeckFeedbackWalk(args: {
  chunks: readonly DeckChunk[];
  groups: readonly SlideGroup[];
  /** The bar's one condition: a moment is open on the paragraph. */
  waiting: (chunk: DeckChunk) => boolean;
  pendingOf: (chunk: DeckChunk) => readonly DocumentSuggestion[];
  /** Where a paragraph sits ("Slide 2"), in the deck's own words. */
  slideLabel: (partId: string) => string | null;
  /** Its slide's title in the speaker's deck, for the walk's bar (backend
   *  N397); none or empty: the bar says `slideLabel`. */
  slideTitle?: (partId: string) => string | null;
  coachMessage: CoachMessage | null;
  /** Marks the coach's word for the Take as seen (useCoachStep). */
  coachSeen: () => void;
  firstTake: boolean;
  /** The Take reviewed, for the summary's "Take N". */
  takeIndex?: number | null;
  /** The page's Take, when the feedback items name none. */
  takeSessionId?: string | null;
  /** The Take's project: the Lounge's walk steps name it, so a tap turns
   *  the lens back on there (lock 2026-10-12, section 1). */
  arcId?: string | null;
  setRootPhrase: (chunk: DeckChunk, phrase: RootPhraseSpan | null) => Promise<boolean>;
  /** The deck's decision on a clearer version: the Feedback sheet's own. */
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  lockPart: (chunk: DeckChunk, text: string) => Promise<LockResult>;
  saveBehind: SaveBehind;
  /** A moment judged or skipped in the walk: its bar leaves the page at
   *  once, settled as the server settles it (the Feedback sheet's own). */
  onJudged?: (s: DocumentSuggestion, decided: "approved" | "dismissed") => void;
  /** The walk ran out onto the page. Nothing else: the old end card is
   *  retired for this flow (lock 2026-10-12, section 2.7). */
  onEnd?: () => void;
  /** ✕ on the review (the lens) turns it off and shows the chat (lock
   *  2026-10-12, section 1). A step opened from the page closes onto the
   *  page instead. */
  onLensClose?: () => void;
  /** The walk was closed (✕), however it was opened. */
  onWalkClose?: () => void;
  /** Opened from the coach's bubble: only what the coach sent (founder
   *  2026-10-14). */
  coachOnly?: boolean;
  /** The coach's link names an earlier Take (N77): only its word. */
  coachWordOnly?: boolean;
  /** The answered items on a paragraph (the replay reads them with the
   *  waiting ones, Q-IT643b A). */
  answeredOf?: (chunk: DeckChunk) => readonly DocumentSuggestion[];
  /** The helper words saved on a paragraph, drawn pressed in the replay. */
  helperWordsOf?: (partId: string) => string | null;
  /** Nothing of this Take waits on the speaker: the walk is finished, and
   *  "Review feedback" under "Record Take N" plays it again. */
  finished?: boolean;
  /** The Take's coach word changed and is not yet seen: a door from the
   *  chat still goes step by step from it, so its Continue marks it seen. */
  coachUnseen?: boolean;
  /** The Take's moments may still land (the readout is not in yet). */
  feedbackPending?: boolean;
}): {
  /** The one door into the walk (founder 2026-10-20, N89): the whole
   *  Take's walk at the step the target names (a Lounge bubble's step, a
   *  paragraph, the coach's word), live while the step waits, as given once
   *  answered. `from` says where ✕ goes back to (B11). */
  review: (target?: WalkStepTarget | null, from?: "chat" | "page") => boolean;
  /** A paragraph of the Ideal Text, with or without its black line: the
   *  walk at what it asks or asked, through `review`. False when no moment
   *  of this Take is on it. */
  openPart: (partId: string) => boolean;
  /** A paragraph's helper words were tapped: that slide's helper-words step
   *  in the same walk, live or finished (lock 2026-10-12, section 4). False
   *  when the paragraph has none. */
  openHelpers: (partId: string) => boolean;
  /** The paragraph has a moment of this Take to open. */
  hasMoment: (partId: string) => boolean;
  /** The paragraph still has a step to answer: it wears the black line
   *  (founder 2026-10-20). */
  waits: (partId: string) => boolean;
  /** Plays the finished walk again (Q-IT643b A). False when there is
   *  nothing to play. */
  replay: (target?: WalkStepTarget | null) => boolean;
  /** Practise on a paragraph's own sheet: the walk's practise screens on the
   *  card the sheet shows (paragraphPractise). False when it cannot open. */
  practisePart: (partId: string, card: PractiseCard, moment: DocumentSuggestion | null) => boolean;
  /** The finished walk has a screen to play again. */
  canReplay: boolean;
  /** The replay has read the Take's answers and tries: a step tapped in
   *  the Lounge opens on it whole. */
  replaySettled: boolean;
  /** The walk can open whole: its hello's name, Last time and the Sniper's
   *  answer are in, or WALK_OPEN_WAIT_MS has passed. The review waits for it
   *  behind the wait cover (A2). */
  walkReady: boolean;
  element: ReactNode;
} {
  const { chunks, groups, waiting, pendingOf, slideLabel, slideTitle, coachMessage, coachSeen, firstTake } = args;
  const { answeredOf, helperWordsOf, finished = false } = args;
  const coachOnly = args.coachOnly === true;
  const practiceOn = usePracticeOn();
  const journal = useWalkJournalPost(true);
  const pageTake = args.takeSessionId ?? null;

  const items = useMemo(
    () => deckWalkItems(chunks, groups, waiting, pendingOf, slideLabel, slideTitle, answeredOf),
    [chunks, groups, waiting, pendingOf, slideLabel, slideTitle, answeredOf],
  );
  const take = useMemo(() => reviewedTake(items, pageTake), [items, pageTake]);
  /* THE TEMPO STEP (backend N162, N166): on the Take's own stretch from the
     backend (step 3), only when one left the green, and only for whoever the
     rings panel's `tempo_step` row reaches (step 6), the founder too: the
     backend answers the step only to them, so it is asked as soon as the
     Take is known, never after the rings are read. Undefined while asked. */
  const tempo = useReviewTempo(!coachOnly ? (args.arcId ?? null) : null, take);
  /* THE WALK QUOTES YOUR NOTEBOOK (backend N268): the speaker's own walk
     only, never a coach's view of it. */
  const quotes = useMemo<WalkQuoteIO | null>(
    () =>
      take && !coachOnly
        ? {
            ask: (said) => askWalkQuote(take, said),
            shown: () => void walkQuoteShown(take),
            notHere: () => void setWalkQuote(false),
            replay: () => replayWalkQuote(take),
          }
        : null,
    [take, coachOnly],
  );
  const interventions = useMemo(() => tempoOffered(tempo, items), [tempo, items]);
  /* LAST TIME (founder 2026-10-31, N309 item 1): the last Take's fix, when
     it rose on this Take, read once per Take; the speaker's own walk only.
     The walk opens once it is read (`walkReady`). */
  const { fix: lastFix, answered: lastAnswered } = useLastFix(args.arcId, take, coachOnly, args.takeIndex);
  /* The Sniper's helper words (N309 item 3): its stretch's words, on the
     paragraph that says them, within the cap of eight; read once here for
     the walk's helper words and the pace game's tip (N347 item 3). */
  const tempoAt = useMemo(() => stretchParagraph(tempo, chunks, groups), [tempo, chunks, groups]);
  const tempoWords = useMemo<FeedbackWalkTempoWords | null>(() => {
    const words = tempoAt?.words ? sniperWords(tempoAt.chunk.part.text, tempoAt.words) : null;
    return tempoAt && words ? { partId: tempoAt.chunk.part.id, paragraphText: tempoAt.chunk.part.text, text: words.text, span: words.span } : null;
  }, [tempoAt]);
  /* The Sniper's slide, for the walk's bar (N435 item 7): the slide of the
     paragraph that says its stretch, by its title from the deck (N397). */
  const tempoSlide = useMemo<string | null>(() => {
    if (!tempoAt) return null;
    return slideTitle?.(tempoAt.chunk.part.id)?.trim() || slideLabel(tempoAt.chunk.part.id) || null;
  }, [tempoAt, slideTitle, slideLabel]);
  /* WHY THE GREEN MOMENT LANDED (founder 2026-10-18): a green clip that
     reached the page before its reason was written is asked for here, and
     the walk draws it once it is in. */
  // Not in the One thing walk (a Take served with slots): their best says
  // why it worked in its signed cue line, with no reason bubble (N309).
  const reasonClips = useMemo(
    () => [...new Set(items.flatMap((i) => (i.green === true && !i.walkSlot && !i.praiseReason && i.clip?.snippetId ? [i.clip.snippetId] : [])))],
    [items],
  );
  const greenReasons = useGreenReasons(args.arcId ?? null, take, reasonClips);
  const reasonsRef = useRef(greenReasons);
  reasonsRef.current = greenReasons;
  /* EVERY STEP IS A LOUNGE MESSAGE (founder lock 2026-10-12, section 1):
     what the walk shows and what the speaker answers, stored once, behind
     the screen. A failed post never stops the walk. */
  const thread = useLoungeThreadMaybe();
  const live = useRef(args);
  live.current = args;
  const threadRef = useRef({ thread, take, arcId: args.arcId ?? null });
  threadRef.current = { thread, take, arcId: args.arcId ?? null };
  // What the closing summary hears (lock 2026-10-12, section 3).
  const heardRef = useRef<WalkHeard>({ practice: null, words: [] });
  const post = useCallback((entry: Omit<WalkThreadEntry, "take" | "arcId">) => {
    hear(heardRef.current, entry.key, entry.author, entry.body);
    const { thread: to, take: on, arcId } = threadRef.current;
    if (!to || !on || (entry.key !== "end" && !entry.extra?.clip && !entry.body.trim())) return;
    const takeIndex = live.current.takeIndex ?? null;
    void to.append(walkStepDraft({ ...entry, take: on, arcId, takeIndex })).catch(() => undefined);
  }, []);
  /* The tempo step in the chat and for Will (N166 step 4): its opening
     lines, each try with the dot's line and Will's word on it (N245), the
     closing line unless a try landed, as Lounge messages like every other
     step, so the walk opened again draws the game as it went (B5, N247);
     the game itself kept for Will's note. As the One thing walk's fix its
     opening keeps its tip, "give “{words}” more room" with the Sniper's
     helper words (a slow stretch's "keep “{words}” moving", N459 item 2),
     for "Last time" next Take (N347 item 3). */
  const onTempo = useCallback(
    (event: TempoEvent, one = false) => {
      if (!tempo) return;
      const say = (key: string, author: "app" | "speaker", body: string, attempt: number | null = null, extra?: Record<string, unknown>) =>
        post({ key, moment: null, attempt, author, body, extra });
      if (event.kind === "opened") {
        const words = one ? tempoWords : null;
        // The stretch's clip, as the speaker's, before Will's line, as the
        // walk draws it: Will's question after the walk quotes the moment it
        // just worked on, the stretch (E2).
        const clip = one ? stretchClipChat(tempo) : null;
        if (clip) say("clip:tempo", "speaker", "", null, { clip });
        // As the walk opens it (N435 item 6): the Sniper's one line.
        const opening = tempoOpening(tempo, one);
        say("tempo:open", "app", [...opening.lines, ...(opening.withScale ? [opening.withScale] : [])].join("\n"), null, words ? { fix_tip: (tempo.reading === "slow" ? ONE_THING_COPY.slowTip : ONE_THING_COPY.paceTip)(words.text) } : undefined);
      } else if (event.kind === "try") {
        say("tempo:try", "speaker", TEMPO_COPY.tryLabel(event.n), event.n, { path: event.path.slice(0, 300).map((v) => Math.round(v * 1000) / 1000) });
        // The Sniper as the One thing walk's fix says its own words (N309).
        const lines = one ? oneThingTempoLines(event.landed, event.n) : afterTry(event.result, event.landed, event.n);
        say("tempo:comment", "app", lines.join("\n"), event.n);
      } else {
        // Left mid-game (✕): kept for Will below, nothing said. Skipped:
        // before a try, or, as the One thing walk's fix, after one too, as
        // the walk draws it (#1183). The Sniper then answers Skip (N405).
        if (!event.left) {
          if (!event.close || (one && event.skipped)) {
            // As the One thing walk's fix, the walk's answer alone (N452 item 1).
            if (one) say("tempo:skipped", "app", ONE_THING_COPY.skipped);
            else say("tempo:skip", "speaker", TEMPO_COPY.skip);
          } else if (!one && !event.tries.some((t) => t.landed)) say("tempo:close", "app", TEMPO_COPY.close[event.close]);
        }
        const arcId = args.arcId ?? null;
        if (arcId && take) void postTempoGame(arcId, take, tempo.reading, event);
      }
    },
    [tempo, tempoWords, post, args.arcId, take],
  );
  /* THE ONE THING WALK JUDGES ONE MOMENT, FROM TAKE 2 (founder 2026-10-31,
     N309 item 2, N300): its machine level the Take's turn, high, middle,
     low; Take 1 judges no one. */
  const judgesOne = (args.takeIndex ?? 0) >= 2;
  const othersLevel = othersLevelFor(args.takeIndex ?? null);
  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items,
        coachNote: coachMessage !== null,
        coachOnly: args.coachOnly === true,
        coachWordOnly: args.coachWordOnly === true,
        practiceOn,
        guest: false,
        interventions,
        judge: judgesOne,
      }),
    [items, coachMessage, practiceOn, args.coachOnly, args.coachWordOnly, interventions, judgesOne],
  );

  /* THE FINISHED WALK, PLAYED AGAIN (founder 2026-10-08, Q-IT643b A): the
     Take's moments, answered or not, with the speaker's own answers (the
     sheets' read) and the helper words as saved. */
  // A paragraph is played again from its own moment at any time (founder
  // 2026-10-10); the whole walk, from "Review feedback", once it is finished.
  const replayReady = answeredOf !== undefined;
  const replayable = replayReady && finished;
  const [ownAnswers, setOwnAnswers] = useState<readonly OwnerAnswer[]>([]);
  const [answersRead, setAnswersRead] = useState(false);
  useEffect(() => {
    if (!replayReady || !pageTake) return;
    let live = true;
    void ownAnswersOf(pageTake)
      .then((answers) => {
        if (live) setOwnAnswers(answers);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setAnswersRead(true);
      });
    return () => {
      live = false;
    };
  }, [replayReady, pageTake]);
  const replayItems = useMemo(
    () =>
      replayReady && answeredOf
        ? deckReplayItems(chunks, groups, (c) => [...pendingOf(c), ...answeredOf(c)], slideLabel, slideTitle)
        : [],
    [replayReady, answeredOf, chunks, groups, pendingOf, slideLabel, slideTitle],
  );
  /* THE TRIES ALREADY HAD (walk first, 2026-10-14): read from the Take's
     thread (each "Practise N" and the answer it got); where the thread has
     none for a practice the walk knows, from the practice itself, read
     once. Nothing is written. */
  const threadMessages = thread?.messages;
  const threadLoaded = thread !== null && !thread.loading;
  const triedByPart = useMemo(
    () => (threadMessages && take ? threadTries(threadMessages, take) : new Map<string, ReplayTries>()),
    [threadMessages, take],
  );
  // The judging of other speakers, reopened from the Lounge, shows the
  // moments already answered in this walk (founder 2026-10-18).
  const othersJudged = useMemo(() => (threadMessages && take ? othersAnswered(threadMessages, take) : 0), [threadMessages, take]);
  // The chat draws a Take's walk as one bubble (N192): the walk shows the
  // summary as the chat holds it, and says "Edited" on helper words picked
  // again in this Take.
  const storedSummary = useMemo(() => (threadMessages && take ? storedSummaryOf(threadMessages, take) : null), [threadMessages, take]);
  const storedSummaryRef = useRef(storedSummary);
  storedSummaryRef.current = storedSummary;
  const editedWords = useMemo(() => (threadMessages && take ? wordsEditedIn(threadMessages, take) : null), [threadMessages, take]);
  // A walk played again holds every step as it went (N247): the tempo step
  // as the chat kept it, when this Take had one.
  const tempoSaid = useMemo(() => (threadMessages && take ? tempoSaidIn(threadMessages, take) : []), [threadMessages, take]);
  const replayInterventions = useMemo<readonly WalkIntervention[]>(() => (tempoSaid.length > 0 ? ["tempo"] : []), [tempoSaid]);
  // "Last time: {the tip}. You did." (N309 item 1): the tip the last Take's
  // walk gave, as its fix step kept it in the chat, read by the server
  // (C-LASTFIX), else looked up in the chat's loaded messages; a Clearer
  // version's is its "Say it straight"; the pace game's "give “{words}” more
  // room" (N347 item 3). No tip kept: no line.
  const lastTime = useMemo<FeedbackWalkLastTime | null>(() => {
    if (!lastFix) return null;
    const kept = lastFix.tip ?? (threadMessages ? lastFixTip(threadMessages, take, args.arcId ?? null, args.takeIndex ?? null) : null);
    const tip = kept ?? (lastFix.kind === "clearer" ? ONE_THING_COPY.sayStraight : null);
    return tip ? { tip: tipSaid(tip), clip: lastFix.clip } : null;
  }, [lastFix, threadMessages, take, args.arcId, args.takeIndex]);
  // How far a finished walk is drawn: through the judging and the summary
  // where the chat holds them (N247).
  const threadEnd = useCallback(
    (done: FeedbackWalkModel<DocumentSuggestion>) =>
      walkThreadEnd(done, (s) =>
        s.key === "summary" ? storedSummary !== null : s.key === "others" ? othersJudged > 0 : true,
      ),
    [storedSummary, othersJudged],
  );
  // The One thing walk's fix as the chat kept it: its AI clip's practice and
  // its tip, so a walk played again shows them (N373 item 2).
  const fixKept = useMemo(() => (threadMessages && take ? fixClipsIn(threadMessages, take) : null), [threadMessages, take]);
  const [triedByPractice, setTriedByPractice] = useState<Readonly<Record<string, ReplayTries | null>>>({});
  const askedPractices = useRef(new Set<string>());
  useEffect(() => {
    if (!replayReady || (thread !== null && !threadLoaded)) return;
    for (const item of replayItems) {
      const practiceId = practiceIdOf(item);
      if (!practiceId || triedByPart.has(item.partId) || askedPractices.current.has(practiceId)) continue;
      askedPractices.current.add(practiceId);
      void fetchConfidencePractice(practiceId).then((r) => {
        setTriedByPractice((t) => ({ ...t, [practiceId]: r.ok ? practiceTries(r.practice) : null }));
      });
    }
  }, [replayReady, thread, threadLoaded, replayItems, triedByPart]);
  /* A step tapped in the Lounge opens once the replay knows the Take's
     answers and tries (founder 2026-10-18: the exercise from its bubble
     shows its whole thread, as from its paragraph). The walk keeps the
     model it opens on, so opening before they land drew the thread empty.
     A read that never answers stops holding it after REPLAY_WAIT_MS. */
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedOut(true), REPLAY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const triesRead =
    (thread === null || threadLoaded) &&
    replayItems.every((item) => {
      const practiceId = practiceIdOf(item);
      return !practiceId || triedByPart.has(item.partId) || practiceId in triedByPractice;
    });
  const replaySettled = !replayReady || waitedOut || ((answersRead || !pageTake) && triesRead);
  const buildReplay = useCallback(
    (answers: readonly OwnerAnswer[]) =>
      buildFeedbackReplay({
        items: replayItems,
        coachNote: replayReady && coachMessage !== null,
        practiceOn,
        coachOnly: args.coachOnly === true,
        coachWordOnly: args.coachWordOnly === true,
        answerOf: (item) => latestAnswerOf(item.id, answers),
        helperWordsOf: (partId) => helperWordsOf?.(partId) ?? null,
        triesOf: (moment) => {
          const fromThread = triedByPart.get(moment.partId);
          if (fromThread) return fromThread;
          const practiceId = momentPracticeId(moment);
          return practiceId ? (triedByPractice[practiceId] ?? null) : null;
        },
        // The fix's clip by the moment's own practice, else the one the chat kept.
        clipOf: (moment) => {
          const kept = fixKept?.get(moment.partId);
          const practiceId = momentPracticeId(moment) ?? kept?.practiceId ?? null;
          return practiceId || kept?.tip ? { practiceId, tip: kept?.tip ?? null } : null;
        },
        interventions: replayInterventions,
        judge: judgesOne,
      }),
    [replayItems, replayReady, coachMessage, practiceOn, helperWordsOf, triedByPart, triedByPractice, fixKept, args.coachOnly, args.coachWordOnly, replayInterventions, judgesOne],
  );
  /* THE WHOLE TAKE'S WALK AS IT STANDS (founder 2026-10-21, B10: every door
     opens the whole walk, "live while that step waits"): what is answered as
     given, each moment that still waits live, all numbered as the Take's
     walk numbered them. A door on a Take not yet finished opens this, never
     the live walk alone, which holds only what waits, renumbered: a lone
     piece, and a step the chat already holds posted again as a new one. */
  const liveAll = useMemo(
    () =>
      replayReady
        ? buildFeedbackWalk({ items: replayItems, coachNote: coachMessage !== null, coachOnly: args.coachOnly === true, coachWordOnly: args.coachWordOnly === true, practiceOn, guest: false, interventions, judge: judgesOne })
        : null,
    [replayReady, replayItems, coachMessage, args.coachOnly, args.coachWordOnly, practiceOn, interventions, judgesOne],
  );
  const waitsOn = useCallback(
    (moment: FeedbackWalkMoment<DocumentSuggestion>) => walkStepForPart(model, moment.partId) !== null,
    [model],
  );
  // The chat holds the Sniper as it was played (a try, a Skip or its
  // closing line): a door keeps it as given. One only opened, then left
  // with ✕ before a try, is still to play, live (B10, T, N458).
  const tempoKept = useMemo(
    () =>
      Boolean(take) &&
      (threadMessages ?? []).some(
        (m) => m.kind === "walk_step" && m.metadata?.take_session_id === take && TEMPO_PLAYED_STEPS.has(String(m.metadata?.step ?? "")),
      ),
    [threadMessages, take],
  );
  const buildWhole = useCallback(
    (answers: readonly OwnerAnswer[]) => {
      const done = buildReplay(answers);
      return liveAll ? walkAsItStands(done, liveAll, waitsOn, tempoKept) : done;
    },
    [buildReplay, liveAll, waitsOn, tempoKept],
  );
  const canReplay = useMemo(
    () => replayable && walkStart(buildReplay(ownAnswers)) !== null,
    [replayable, buildReplay, ownAnswers],
  );
  // The model the walk is opened on, held while it is open as the walk
  // holds it: the replay's while it plays, else the live walk as it stood at
  // the opening. A moment settled as the walk goes past it (`momentDone`)
  // leaves the live model, which numbers its moments afresh; the chat and
  // the coach's queue still hear the steps the speaker sees.
  const [replaying, setReplaying] = useState<typeof model | null>(null);
  const walkModel = replaying ?? model;
  const walkModelRef = useRef(walkModel);
  walkModelRef.current = walkModel;

  const seqRef = useRef(0);
  const [request, setRequest] = useState<FeedbackWalkRequest | null>(null);
  // What this opening of the walk already told the server (D-FW-19).
  const toldRef = useRef(new Set<string>());
  // This opening is a paragraph's practise: its end is the page, not the
  // walk's end card.
  const practisingRef = useRef(false);
  // This opening is the review itself (the lens), not a step from the page.
  const lensRef = useRef(false);
  // The paragraphs whose helper words this opening saved (the chat may not
  // hold the speaker's bubble yet).
  const wordsSavedRef = useRef(new Set<string>());
  /** Opens the walk standing on `at`; `head`, further on, is the furthest
   *  part drawn (a walk already answered past `at`: its parts there to
   *  scroll, founder 2026-10-21). */
  const openAt = useCallback((at: number | null, practising = false, lens = false, how?: WalkDir, head?: number | null): boolean => {
    if (at === null) return false;
    practisingRef.current = practising;
    lensRef.current = lens;
    toldRef.current = new Set<string>();
    wordsSavedRef.current = new Set<string>();
    seqRef.current += 1;
    setRequest({ seq: seqRef.current, at, how, ...(head != null && head > at ? { head } : {}) });
    return true;
  }, []);

  const coachSeenRef = useRef(coachSeen);
  coachSeenRef.current = coachSeen;
  // A Lounge bubble of another Take: this page holds the latest Take's
  // walk only, so no step of it is opened in that bubble's place.
  const otherTake = useCallback(
    (target?: WalkStepTarget | null) => Boolean(target?.take && pageTake && target.take !== pageTake),
    [pageTake],
  );
  // ONE MECHANISM (founder 2026-10-20, N89: "the SAME WAY"): every door opens
  // the whole Take's walk at the step it names. Live while that step waits
  // (its own buttons); as given once answered (read only; the helper words
  // still editable on the latest Take). The paragraph's own narrowed walk,
  // which closed onto the Ideal Text once the paragraph was done, and the
  // finished walk with no buttons are history. The Feedback walk standing on
  // helper words is no exception (B10, C3): those words opened on their own,
  // before the Take's tries were read, showed them alone (founder
  // 2026-10-28: "it just opens helper words").
  // Opened again with something left to do (N541): the walk as it stands,
  // standing on the first thing left, everything before it as given. False
  // when the Take is finished or nothing is left.
  const openLeftToDo = useCallback((): boolean => {
    const whole = !finished && replayReady ? buildWhole(ownAnswers) : null;
    if (!whole || whole.waitsAt == null) return false;
    setReplaying(whole);
    return openAt(whole.waitsAt, false, true, undefined, answeredRun(whole, whole.waitsAt, waitsOn));
  }, [finished, replayReady, buildWhole, ownAnswers, openAt, waitsOn]);
  const review = useCallback((target?: WalkStepTarget | null, from: "chat" | "page" = "chat"): boolean => {
    if (otherTake(target)) return true;
    setReplaying(null);
    const lens = from === "chat";
    // THE COACH'S DOOR (founder 2026-10-21, WIL-93: "ok do it"): the coach's
    // whole walk for the Take, read or not. The live walk holds only what
    // still waits, so a word already seen and moments already answered left
    // it empty: it opened and closed at once.
    const coachDoor = !target && coachOnly;
    const reopened = reopenedFromChat({ lens, target, coachOnly, coachUnseen: live.current.coachUnseen === true });
    if (reopened && openLeftToDo()) return true;
    // Finished, or opened again with nothing left: a scroll (N259, N539).
    const asScroll = finished || reopened;
    // A finished Take (nothing waits, the coach's word seen) is walked as
    // given: its live model holds only the tail (others, the summary), never
    // the step asked for (founder 2026-10-21).
    const liveAt = asScroll ? null : walkStepAt(model, target);
    // The whole Take's walk, standing on the step asked for: as given once
    // answered (prototype v31), live while it waits, its buttons in the dock
    // either way, the parts before it there to scroll (founder 2026-10-21).
    const done = (target || coachDoor) && replayReady ? (asScroll ? buildReplay(ownAnswers) : buildWhole(ownAnswers)) : null;
    const doneAt = done ? (coachDoor ? walkStart(done) : walkStepAt(done, target)) : null;
    // A door from the chat never shows the text in the walk's place.
    const standAt = standAtOf(done, doneAt, asScroll, lens);
    if (done && standAt !== null) {
      setReplaying(done);
      // The parts after it too, as far as the walk was walked: on a finished
      // Take its last step, else up to the next step that still waits. The
      // coach's door, while something waits, goes step by step from the
      // word, so its Continue still marks the word seen.
      return openAt(standAt, false, lens, undefined, asScroll ? threadEnd(done) : coachDoor ? null : answeredRun(done, standAt, waitsOn));
    }
    if (target?.part && liveAt === null && !lens) return false;
    // Opening marks nothing: only Continue on the coach's word does (N80).
    // A finished walk with no such step still opens, at its start, never
    // the text in its place.
    if (done && walkStart(done) !== null && liveAt === null && walkStart(model) === null) {
      setReplaying(done);
      return openAt(walkStart(done), false, lens, undefined, threadEnd(done));
    }
    setReplaying(model);
    return openAt(liveAt ?? walkStart(model), false, lens);
  }, [model, finished, coachOnly, openAt, otherTake, replayReady, buildReplay, buildWhole, waitsOn, ownAnswers, threadEnd, openLeftToDo]);

  const openPart = useCallback((partId: string): boolean => review({ part: partId }, "page"), [review]);

  const replay = useCallback((target?: WalkStepTarget | null): boolean => {
    if (otherTake(target)) return true;
    if (!canReplay) return false;
    void ownAnswersOf(pageTake).then((answers) => {
      const again = buildReplay(answers);
      // The whole review in the thread: on the step asked for, else on its
      // newest step with the rest above to scroll back to (the prototype's
      // "Review feedback" on a finished Take), drawn through its summary (N247).
      const at = walkStepAt(again, target) ?? walkLastStep(again) ?? walkStart(again);
      if (at === null) return;
      setOwnAnswers(answers);
      setReplaying(again);
      openAt(at, false, true, undefined, threadEnd(again));
    });
    return true;
  }, [canReplay, pageTake, buildReplay, openAt, otherTake, threadEnd]);

  // The paragraph has a moment of this Take to open, waiting or answered;
  // only one still waiting wears the black line (founder 2026-10-20).
  const replayNow = useMemo(() => (replayReady ? buildReplay(ownAnswers) : null), [replayReady, buildReplay, ownAnswers]);
  const hasMoment = useCallback(
    (partId: string): boolean =>
      walkStepForPart(model, partId) !== null || (replayNow !== null && walkStepForPart(replayNow, partId) !== null),
    [model, replayNow],
  );
  const waits = useCallback((partId: string): boolean => walkStepForPart(model, partId) !== null, [model]);

  const openHelpers = useCallback(
    (partId: string): boolean => {
      // The live walk's step while the paragraph still waits; else the
      // finished walk's, where the words stay editable.
      const liveAt = walkHelpersForPart(model, partId);
      if (liveAt !== null) {
        setReplaying(model);
        return openAt(liveAt);
      }
      const now = replayReady ? buildReplay(ownAnswers) : null;
      const at = now ? walkHelpersForPart(now, partId) : null;
      if (now && at !== null) {
        // The words as given, the rest of the walk there to scroll (founder
        // 2026-10-21: "not scrollable to the next step of the walk"). A scroll
        // once the Take is done (N259); while a moment still waits, its
        // buttons, so Next goes on to what waits.
        setReplaying(finished ? now : { ...now, scroll: false });
        return openAt(at, false, false, undefined, threadEnd(now));
      }
      // No step for it in this Take's walk: the helper words on their own.
      const chunk = live.current.chunks.find((c) => c.part.id === partId);
      if (!chunk) return false;
      setReplaying(
        paragraphHelpers({
          partId,
          paragraphText: chunk.part.text,
          slideLabel: live.current.slideLabel(partId),
          helperWords: live.current.helperWordsOf?.(partId) ?? null,
        }),
      );
      return openAt(1, true);
    },
    [model, replayReady, buildReplay, ownAnswers, openAt, threadEnd, finished],
  );

  const practisePart = useCallback(
    (partId: string, card: PractiseCard, moment: DocumentSuggestion | null): boolean => {
      const chunk = live.current.chunks.find((c) => c.part.id === partId);
      if (!chunk) return false;
      const one = paragraphPractise({
        card,
        moment,
        partId,
        paragraphText: chunk.part.text,
        slideLabel: live.current.slideLabel(partId),
      });
      if (!one) return false;
      setReplaying(one);
      return openAt(1, true);
    },
    [openAt],
  );

  const saveHelperWords = useCallback((save: FeedbackWalkHelperWords) => {
    // Each new pick is its own bubble; the chat strikes the ones it replaces.
    // The speaker's bubble says the words without the sentence's punctuation
    // at either end, as the walk shows them (founder 2026-10-21, B7). The One
    // thing walk's come on their own: the walk says them, with its line
    // (N309 item 3).
    const words = helperWordsSaid(stripRichMarkers(save.span.text));
    post(
      save.auto
        ? { key: `words:${save.partId}:${words}`, moment: null, attempt: null, author: "app", body: `${ONE_THING_COPY.helperWords}\n${words}`, extra: { words_of: save.partId } }
        : { key: `words:${save.partId}:${words}`, moment: null, attempt: null, author: "speaker", body: words, extra: { words_of: save.partId } },
    );
    wordsSavedRef.current.add(save.partId);
    const { chunks: now, setRootPhrase, lockPart, saveBehind } = live.current;
    const chunk = now.find((c) => c.part.id === save.partId);
    if (!chunk) return;
    // The Clearer version's sentence is not the paragraph's: to the slide,
    // from the practice it was opened on (N309 item 3).
    if (save.practiceId) {
      const practiceId = save.practiceId;
      saveBehind(
        () => helperWordsFromPracticeBehind(setHelperWordsFromPractice, lockPart, chunk, practiceId, save.span.text),
        CHUNK_SHEET_COPY.failWordsBehind,
      );
      return;
    }
    const found = spanOnLiveText(save, chunk.part.text);
    // The words already saved, pressed again: nothing to write.
    if (found && sameHelperWords(found.text, live.current.helperWordsOf?.(save.partId))) return;
    // The walk's own words are saved whole, past the cap on a pick by hand
    // (N323 item 2).
    const span = found && save.auto ? { ...found, whole: true } : found;
    saveBehind(
      async () => (span ? helperWordsBehind(setRootPhrase, lockPart, chunk, span) : "final"),
      CHUNK_SHEET_COPY.failWordsBehind,
    );
  }, [post]);
  const acceptClearer = useCallback((item: DocumentSuggestion, label?: string | null) => {
    // The One thing walk's "Try it" and "Keep mine" post nothing (N452 item 1).
    if (label !== null) post({ key: `clearer:${item.id}`, moment: null, attempt: null, author: "speaker", body: label ?? CHUNK_SHEET_COPY.pillAcceptPractise });
    // The coach's version is practised, never written on the text.
    if (coachVersionOf(item)) return;
    const { onAccept, saveBehind } = live.current;
    saveBehind(() => acceptRewriteBehind(onAccept, item), CHUNK_SHEET_COPY.failApply);
  }, [post]);
  const keepWords = useCallback((item: DocumentSuggestion, label?: string | null) => {
    // The One thing walk's "Try it" and "Keep mine" post nothing (N452 item 1).
    if (label !== null) post({ key: `clearer:${item.id}`, moment: null, attempt: null, author: "speaker", body: label ?? CHUNK_SHEET_COPY.linkKeepMyWords });
    if (coachVersionOf(item)) return;
    const { onKeepMine, saveBehind } = live.current;
    saveBehind(() => keepWordsBehind(onKeepMine, item), CHUNK_SHEET_COPY.failKeep);
  }, [post]);
  const judge = useCallback((save: WalkJudgementSave<DocumentSuggestion>) => {
    const { saveBehind, onJudged } = live.current;
    const { item, answer } = save;
    if (item.takeSessionId) noteOwnAnswer(item.takeSessionId, item.id, answer);
    onJudged?.(item, judgedStatus(answer === "yes" ? "yes" : "other"));
    saveBehind(() => judgementBehind(save), CHUNK_SHEET_COPY.failAnswerBehind);
  }, []);
  const skipJudging = useCallback((items: DocumentSuggestion[]) => {
    skipJudgements(items, (item) => live.current.onJudged?.(item, "dismissed"));
  }, []);
  /* WALKED THROUGH IS ANSWERED (founder 2026-10-21: "the black lines on the
     ideal text are still there even though I walked through them"). Since
     the walk stopped asking the speaker to judge their own moments, nothing
     settled a moment it went past, so its paragraph kept the black line and
     opened its practise again. A paragraph's own practise and the coach's
     door settle nothing. */
  const momentDone = useCallback((moment: FeedbackWalkMoment<DocumentSuggestion>, end: WalkMomentEnd) => {
    const { chunks: now, pendingOf: openOf, onJudged, coachOnly: coachDoor } = live.current;
    if (practisingRef.current || coachDoor) return;
    const parts = walkModelRef.current.partsOf[moment.index] ?? [moment.partId];
    const open = now.filter((c) => parts.includes(c.part.id)).flatMap((c) => openOf(c)).filter(isConfidentVoiceFeedback);
    const { thread: chat, take: on } = threadRef.current;
    const picked = chat && on ? wordsPickedIn(chat.messages, on) : null;
    const words = parts.some((p) => wordsSavedRef.current.has(p) || picked?.has(p) === true);
    settleWalked(open, end, words, (item, status) => onJudged?.(item, status));
  }, []);
  const practise = useMemo(() => {
    const io = walkPractiseIO<DocumentSuggestion>(suggestionSource);
    // The moment each practice was opened on, so its tries name their
    // paragraph (a tap in the chat finds the exercise by it).
    const openedOn = new Map<string, { moment: number | null; part_id: string | null }>();
    const open: typeof io.open = async (item, passage) => {
      const practiceId = await io.open(item, passage);
      if (practiceId) {
        const moment = walkModelRef.current.moments.find(
          (m) => m.exercise?.item.id === item.id || m.practiseItem?.id === item.id || m.clearer?.item.id === item.id,
        );
        openedOn.set(practiceId, { moment: moment?.index ?? null, part_id: moment?.partId ?? null });
      }
      return practiceId;
    };
    // Each try, once uploaded, is the speaker's orange bubble with its voice
    // (prototype v31 `try`): in the One thing walk the words of the try, as
    // the walk draws it (`oneThingTryWords`), else "Practise N" (a Take
    // served before N289, C7). The practice and attempt ids find the signed
    // link again.
    const upload: typeof io.upload = async (practiceId, audio, durationSec, stoppedAtMs, words) => {
      const sent = await io.upload(practiceId, audio, durationSec, stoppedAtMs, words);
      // A try the server could not hear is no try: nothing in the chat.
      if (sent && !("unheard" in sent)) {
        const on = openedOn.get(practiceId) ?? { moment: null, part_id: null };
        post({
          key: `try:${practiceId}`,
          moment: on.moment,
          attempt: sent.attempt,
          author: "speaker",
          body: words || WALK_COPY.practiseN(sent.attempt),
          extra: {
            part_id: on.part_id,
            ...(sent.audio
              ? {
                  clip: {
                    src: sent.audio.url,
                    start_ms: null,
                    duration_ms: sent.audio.durationMs,
                    practice_id: practiceId,
                    attempt_id: sent.attemptId,
                    words: null,
                  },
                }
              : {}),
          },
        });
      }
      return sent;
    };
    return { ...io, open, upload };
  }, [post]);
  // The closing summary, the walk's last step (lock 2026-10-12, sections
  // 2.7 and 3): written once per Take and read back for the bubble, then
  // the thread reloads so it shows in the Lounge too. Null: the step is
  // skipped. The thread reads again whatever the answer: the backend may
  // have written the chain after it (Will's question, the goodbye) even
  // when the answer came back too late. Until it has, the Lounge shows the
  // typing dots, its one wait (B8), until the one real ask ends. Asked
  // once per Take (`summaryAsks`); a failed ask is asked again at the
  // walk's next end.
  const summary = useCallback((): Promise<string | null> => {
    const { thread: to, take: on, arcId } = threadRef.current;
    if (!on || !arcId) return Promise.resolve(null);
    const asked = summaryAsks.get(on);
    if (asked) return asked;
    // What this walk heard, with what the chat kept of the Take's walk: a
    // page opened later, or a walk played again, posts no try again.
    const own = heardRef.current;
    const kept = heardIn(to?.messages ?? [], on);
    const practice = own.practice === "better" || kept.practice === "better" ? "better" : (own.practice ?? kept.practice);
    const helperWords = [...kept.words.filter((w) => !own.words.includes(w)), ...own.words].slice(-2);
    to?.setWriting?.(true);
    const ask = (async () => {
      try {
        const text = await postReviewSummaryText(arcId, {
          takeSessionId: on,
          practice,
          helperWords,
          coachNote: live.current.coachMessage?.text ?? null,
        });
        if (text === null) summaryAsks.delete(on);
        return text;
      } finally {
        await to?.reload?.().catch(() => undefined);
        to?.setWriting?.(false);
      }
    })();
    summaryAsks.set(on, ask);
    return ask;
  }, []);
  // A paragraph's practise ends on the page quietly; the review's end tells
  // the Lounge (the walk's outline leaves it) and lands on the Ideal Text.
  // The review's end is written once per Take, also when the walk closes
  // with nothing left to answer, so the review is over (founder 2026-10-14).
  const endedRef = useRef<string | null>(null);
  // The walk on screen is a scroll (N259, 2026-11-06): its ✕ and Close end
  // the review.
  const scrollingRef = useRef(false);
  scrollingRef.current = replaying?.scroll === true;
  const postEnd = useCallback(() => {
    const { thread: to, take: on } = threadRef.current;
    if (!on || endedRef.current === on) return;
    endedRef.current = on;
    const written = to?.messages.some(
      (m) => m.kind === "walk_step" && m.metadata?.step === "end" && m.metadata?.take_session_id === on,
    );
    if (!written) post({ key: "end", moment: null, attempt: null, author: "app", body: "" });
  }, [post]);
  /* THE CHAT AFTER THE WALK, HOWEVER IT ENDS (C9, D4, B11): the summary is
     asked once per Take as the review's end is written, by the Close pill,
     by ✕ on a finished walk, or as a finished Take's page opens, so the
     chain after it (Will's question, the goodbye) always comes. Not for a
     paragraph's own practise, nor the coach-only walk. */
  const askSummary = useCallback(() => {
    // `summary` asks once per Take itself, and nothing without a Take.
    if (practisingRef.current || live.current.coachOnly || storedSummaryRef.current !== null) return;
    void summary();
  }, [summary]);
  /* BETWEEN TWO TAKES (D4, N244, N251): ✕ and a finished Take's page as it
     opens ask only when the loaded chat's newest recording is this Take's
     own. Not knowing counts as a newer Take, so an older Take's chain never
     lands under the newest one. The Close pill on a live walk asks as
     before. */
  const askSummaryAsNewest = useCallback(() => {
    const { thread: to, take: on } = threadRef.current;
    if (on && !recordedSince(to?.messages ?? [], on)) askSummary();
  }, [askSummary]);
  const ended = finished && !args.feedbackPending && thread !== null && !thread.loading;
  useEffect(() => {
    if (!ended || request !== null) return;
    postEnd();
    askSummaryAsNewest();
  }, [ended, request, postEnd, askSummaryAsNewest]);
  const onEnd = useCallback(() => {
    // A paragraph's own practise or helper words end nothing either, but
    // the page still hears it: a lens opened on them shows the text then.
    // The coach-only walk is not the review: it ends nothing.
    if (!practisingRef.current && !live.current.coachOnly) postEnd();
    live.current.onEnd?.();
  }, [postEnd]);
  const onClose = useCallback(() => {
    // ✕ on a finished walk ends the review as Close does (B11, C9). The
    // coach-only walk is not the review: it ends nothing.
    // So do ✕ and Close on a walk opened again as a scroll (2026-11-06).
    const { finished, feedbackPending, coachOnly: coachDoor } = live.current;
    const done = finished || scrollingRef.current;
    if (!practisingRef.current && !coachDoor && done && !feedbackPending) {
      postEnd();
      askSummaryAsNewest();
    }
    if (lensRef.current) live.current.onLensClose?.();
    live.current.onWalkClose?.();
  }, [postEnd, askSummaryAsNewest]);
  /* "LESSON DONE." AND CLOSE (founder 2026-10-31, N309 item 4): the review's
     end is written, so the review is over and the Take's card lands
     under its Feedback walk; the walk closes back to the chat. The summary
     is no longer a step of the walk, and is still written once per Take as
     the walk ends, so the chat's chain after the review (its card, the one
     ask, the closing message with "Record Take N") runs as before. */
  const onLessonDone = useCallback(() => {
    if (practisingRef.current || live.current.coachOnly) return;
    postEnd();
    askSummary();
  }, [postEnd, askSummary]);
  // NEXT GOES TO WHAT STILL WAITS (founder 2026-10-14, walk first): on a
  // step played again, while a moment of this Take still waits, Next goes
  // to the live walk's first waiting step; with nothing waiting it plays on.
  const onForward = useCallback((): boolean => {
    // The whole walk as it stands has what waits in it: Next walks on.
    if (!replaying?.replay || replaying.asItStands || items.length === 0) return false;
    const at = walkStart(model);
    if (at === null) return false;
    setReplaying(model);
    openAt(at, false, lensRef.current);
    return true;
  }, [replaying, items.length, model, openAt]);
  /** The walk showed the coach's note or a moment: the server hears it once
   *  per opening, behind the screen, and the Lounge's "new" clears. */
  /** A walk screen reached the speaker: the server hears it at once, once
   *  per opening (the coach's queue, the coach's feedback seen), whatever the
   *  chat still waits for (founder 2026-10-20). */
  const onReached = useCallback(
    (step: WalkStep, moment: FeedbackWalkMoment<DocumentSuggestion> | null) => {
      const { chunks: now, pendingOf: openOf } = live.current;
      const parts = moment ? (walkModel.partsOf[moment.index] ?? []) : [];
      const openOn = now.filter((c) => parts.includes(c.part.id)).flatMap((c) => openOf(c));
      tellShown(toldRef.current, step, moment, openOn);
    },
    [walkModel],
  );
  const onShown = useCallback(
    (
      step: WalkStep,
      moment: FeedbackWalkMoment<DocumentSuggestion> | null,
      say: (bank: WalkBankKey) => string,
      ai?: WalkAiShown | null,
      line?: string | null,
      fixTip?: string | null,
      phrase?: string | null,
    ) => {
      const { coachMessage: coach } = live.current;
      const at = { moment: step.moment ?? null, attempt: step.attempt ?? null };
      // The AI bubble in the locked one's place (N71) says what the screen
      // says once its clip is in; it keeps the plain words for a clip that
      // never comes (founder 2026-10-20).
      const plain = ai ? shownStep(step, moment, coach?.text ?? null, say, line ?? null) : null;
      const aiSaid = ai ? aiVoiceChat(ai, plain?.body ?? null) : null;
      // Its clip is asked now, so the chat's bubble is drawn whole.
      if (ai) void readAiVoiceOnce(ai.practiceId);
      // A try's answer played again was said once, as the try was made.
      const replayedTry = step.replay === true && TRY_ANSWER_STEPS.has(step.key);
      let said = replayedTry ? null : (aiSaid ?? shownStep(step, moment, coach?.text ?? null, say, line ?? null));
      // The coach's word reaches the chat once per Take (founder 2026-10-19,
      // N80, D4): never a second copy under "Later · from your coach", never
      // re-stamped to the bottom. Its video as a thumb in the bubble
      // (prototype v31).
      if (step.key === "coachnote") said = coachNoteOnce(said, coach, threadRef.current, Boolean(step.replay || walkModel.replay));
      said = withLateReason(said, step, moment, reasonsRef.current);
      // The label above a moment, and the speaker's clip before its bubble.
      const chat = said ? momentChat(walkModel.plan, step, moment, phrase ?? null) : null;
      // The moment's paragraph: a tap in the chat finds the step by it.
      const part = chatPartOf(step, moment, ai, fixTip ?? null);
      postLevel(post, step, moment, Boolean(said), { ...at, extra: { ...part } });
      if (chat?.clip) post({ key: `clip:${step.key}`, ...at, author: "speaker", body: "", extra: { ...chat.label, clip: chat.clip, ...part } });
      if (said) post({ key: step.key, ...at, ...said, extra: { ...(chat?.clip ? {} : chat?.label), ...said.extra, ...part } });
      // The coach's answer on the moment: their bubble in the chat too.
      const answer = moment?.coachAnswer;
      if (answer && COACH_ANSWER_STEPS.has(step.key)) {
        post({ key: "coach-answer", moment: at.moment, attempt: null, author: "coach", body: `${CHUNK_SHEET_COPY.titleCoachLine}\n${answer.text}`, extra: { ...(answer.videoUrl ? { video: answer.videoUrl } : {}), ...part } });
      }
      onReached(step, moment);
    },
    [walkModel, post, onReached],
  );

  /* OTHER SPEAKERS' MOMENT IS THERE WHEN THE WALK GETS THERE (C8, N309 item
     2): the One thing walk's one moment, from Take 2, asked as the walk
     opens, while the speaker walks the steps before it; not once the
     chat holds their answer to it. */
  useEffect(() => {
    if (!request || !take || !othersLevel || coachOnly || othersJudged > 0) return;
    const plan = walkModelRef.current.plan;
    const at = plan.findIndex((s) => s.key === "others" && s.one === true && !s.replay && !s.readOnly);
    if (at >= request.at) prefetchOtherClips(take, othersLevel);
  }, [request, take, othersLevel, coachOnly, othersJudged]);

  /** Another speaker's moment, shown or answered: in the chat. */
  const onOthers = useCallback(
    (at: number, of: number, from: string | null, answer: string | null, one?: boolean) => {
      // The One thing walk's one moment says its own words (N309 item 2).
      if (one) {
        othersOneChat(answer).forEach(post);
        return;
      }
      const entry = othersChat(at, of, from, answer);
      if (entry) post(entry);
    },
    [post],
  );

  /** The speaker answered a step: their own bubble in the chat. */
  const onAnswer = useCallback(
    (step: WalkStep, value: string) => {
      const body = answerBody(step, value);
      const part_id = step.moment != null ? (walkModel.moments[step.moment]?.partId ?? null) : null;
      if (body) post({ key: `answer:${step.key}`, moment: step.moment ?? null, attempt: step.attempt ?? null, author: "speaker", body, extra: { part_id } });
      // The walk's answer to Skip on the One thing walk's fix (N405), with
      // no "Skip" of the speaker's above it (N452 item 1).
      const reply = skipReply(step, value);
      if (reply) post({ key: `skipped:${step.key}`, moment: step.moment ?? null, attempt: step.attempt ?? null, author: "app", body: reply });
      // Continue on the coach's word: the one "watched" (N80, D4), in the
      // live walk, the coach-only walk (WhatsApp, email, the dot card) and
      // a replay alike (the replay leaves this step live).
      if (step.key === "coachnote") coachSeenRef.current();
    },
    [post, walkModel],
  );

  // The walk's hello names the speaker (N120): the first name from the
  // account, read once per page with the rest of the profile (a guest, or a
  // read that fails: the hello without a name).
  const [firstName, setFirstName] = useState<string | null>(null);
  // The walk opens once the name is read (`walkReady`), so the hello never
  // changes in place (C0, B5).
  const [nameRead, setNameRead] = useState(false);
  useEffect(() => {
    let on = true;
    void fetchUserProfileShared()
      .then((profile) => {
        if (on) setFirstName(profile?.first_name ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (on) setNameRead(true);
      });
    return () => {
      on = false;
    };
  }, []);
  /* THE WALK OPENS WHOLE, BEHIND THE WAIT (A2, B5, C0, C0a, T): once the
     speaker's name and Last time are read, and the tempo answer where the
     Sniper may be the walk's fix (the server chose it, or served no choice),
     so the hello never swaps, Last time is there before their best, and the
     Sniper is never lost to a race. Never longer than WALK_OPEN_WAIT_MS
     from when the walk has its moments (marks that land late start it
     again), well inside the wait's own patience (waitHandover
     LENS_APPEAR_MS, the lens's LENS_WATCHDOG_MS). The coach's door waits
     for none of it. */
  const [openWaited, setOpenWaited] = useState(false);
  const hasItems = items.length > 0;
  useEffect(() => {
    setOpenWaited(false);
    const timer = setTimeout(() => setOpenWaited(true), WALK_OPEN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [hasItems]);
  const walkReady = coachOnly || openWaited || walkOpens({ items, tempo, nameRead, lastAnswered, lastFix, thread });
  const element = useMemo(
    () => (
        <FeedbackWalk
          model={walkModel}
          request={request}
          coachNote={coachMessage}
          firstTake={firstTake}
          firstName={firstName}
          takeIndex={args.takeIndex ?? null}
          takeId={take}
          onSaveHelperWords={saveHelperWords}
          onAcceptClearer={acceptClearer}
          onKeepWords={keepWords}
          practise={practise}
          onJudge={judge}
          onSkipJudging={skipJudging}
          journal={journal}
          summary={summary}
          storedSummary={storedSummary}
          editedWords={editedWords ?? undefined}
          onEnd={onEnd}
          onForward={onForward}
          onClose={onClose}
          lines={lineBankIO}
          onShown={onShown}
          onReached={onReached}
          onAnswer={onAnswer}
          onMomentDone={momentDone}
          onOthers={onOthers}
          reasons={greenReasons}
          othersJudged={othersJudged}
          tempo={tempo ?? null}
          tempoAsking={tempo === undefined}
          tempoSaid={tempoSaid}
          onTempo={onTempo}
          quotes={quotes}
          lastTime={lastTime}
          othersLevel={othersLevel}
          tempoWords={tempoWords}
          tempoSlide={tempoSlide}
          helperWordsOf={helperWordsOf ?? null}
          onLessonDone={onLessonDone}
        />
    ),
    [
      walkModel,
      request,
      coachMessage,
      firstTake,
      firstName,
      args.takeIndex,
      take,
      summary,
      storedSummary,
      editedWords,
      saveHelperWords,
      acceptClearer,
      keepWords,
      practise,
      judge,
      skipJudging,
      journal,
      onEnd,
      onForward,
      onClose,
      onShown,
      onReached,
      onAnswer,
      momentDone,
      onOthers,
      greenReasons,
      othersJudged,
      tempo,
      tempoSaid,
      onTempo,
      quotes,
      lastTime,
      othersLevel,
      tempoWords,
      tempoSlide,
      helperWordsOf,
      onLessonDone,
    ],
  );

  return useMemo(
    () => ({ review, openPart, openHelpers, hasMoment, waits, replay, canReplay, replaySettled, walkReady, practisePart, element }),
    [review, openPart, openHelpers, hasMoment, waits, replay, canReplay, replaySettled, walkReady, practisePart, element],
  );
}

/** What a shown step's chat messages carry besides their words: the
 *  moment's paragraph, so a tap in the chat finds the step by it, and on the
 *  One thing walk's fix its tip, for "Last time" next Take (N309). Pure. */
function chatPartOf(
  step: WalkStep,
  moment: { partId: string } | null,
  ai: { line: string } | null | undefined,
  noClipTip: string | null = null,
): { part_id: string | null; fix_tip?: string } {
  // With no AI clip, the tip the fix said in words (N370).
  const tip = step.one ? (fixTipOf(step, ai ?? null) ?? noClipTip) : null;
  return tip ? { part_id: moment?.partId ?? null, fix_tip: tip } : { part_id: moment?.partId ?? null };
}

/** The tip the One thing walk's fix gave (N309 item 1), kept with its step
 *  for "Last time" next Take: the AI clip's tip without ", like this:", or
 *  the Clearer version's "Say it straight". Null: none. Pure. */
export function fixTipOf(step: WalkStep, ai: { line: string } | null): string | null {
  if (step.key === "clearer") return ONE_THING_COPY.sayStraight;
  if (step.key !== "exVideo" || !ai?.line) return null;
  const tip = ai.line.replace(/, like this:$/, "").trim();
  return tip && tip !== ai.line ? tip : null;
}

/** Two helper word sets read the same, markers and case aside. Pure. */
export function sameHelperWords(a: string, b: string | null | undefined): boolean {
  if (!b) return false;
  const norm = (t: string) => stripRichMarkers(t).replace(/\s+/g, " ").trim().toLowerCase();
  return norm(a) === norm(b);
}

/** Nothing of the Take waits on the speaker: no open moment and no unseen
 *  word from the coach. The walk is finished (Q-IT643b A). Pure. */
export function walkFinished(ready: boolean, firstWaiting: number, coachWordUnseen: boolean): boolean {
  return ready && firstWaiting < 0 && !coachWordUnseen;
}

/** The host's "Review feedback" link under "Record Take N" (Q-IT643b A):
 *  the host hears whether the finished walk can play again, and each bump
 *  of its request plays it. */
export function useWalkReplayRequest(
  walk: { replay: (target?: WalkStepTarget | null) => boolean; canReplay: boolean; replaySettled?: boolean },
  request: number | undefined,
  onReady: ((ready: boolean) => void) | undefined,
  target?: WalkStepTarget | null,
): void {
  const { canReplay, replay, replaySettled = true } = walk;
  useEffect(() => {
    onReady?.(canReplay);
  }, [canReplay, onReady]);
  const seenRef = useRef(request);
  useEffect(() => {
    if (request === seenRef.current) return;
    // A step tapped in the Lounge waits for the Take's answers and tries.
    if (target && !replaySettled) return;
    seenRef.current = request;
    replay(target);
    // The target rides with the request; a new target alone opens nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, replay, replaySettled]);
}
