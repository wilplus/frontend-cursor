"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { postReviewSummaryText } from "@/services/api/reviewSummaryText";
import { useLoungeThreadMaybe } from "./LoungeThreadContext";
import { aiVoiceChat, answerBody, momentChat, othersChat, shownStep, walkStepDraft, type WalkThreadEntry } from "@/lib/willab/walkThread";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { WalkBankKey } from "@/lib/willab/walkLines";
import type { WalkDir } from "@/lib/willab/walkMotion";
import type { FeedbackWalkModel, FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import FeedbackWalk, {
  walkBrowseFrom,
  type FeedbackWalkHelperWords,
  type FeedbackWalkRequest,
  type WalkAiShown,
  type WalkBrowseDir,
  type WalkHop,
} from "./walk/FeedbackWalk";
import type { WalkJudgementSave } from "./walk/useWalkJudging";
import { useWalkJournalPost } from "./useWalkJournalPost";
import { noteOwnAnswer, ownAnswersOf } from "./paragraphSheetData";
import type { OwnerAnswer } from "@/services/api/bookmarkHistory";
import { CHUNK_SHEET_COPY, WALK_COPY } from "./idealEditCopy";
import {
  acceptRewriteBehind,
  helperWordsBehind,
  keepWordsBehind,
  type SaveBehind,
} from "./saveBehind";
import { answerChanged, latestAnswerOf, reopensJudgement } from "@/lib/willab/changeJudgement";
import { judgedStatus } from "@/lib/willab/chunkSteps";
import {
  buildFeedbackReplay,
  buildFeedbackWalk,
  walkHelpersForPart,
  walkStart,
  walkStepForPart,
  walkStepAt,
  type WalkStepTarget,
  type FeedbackWalkItem,
  type FeedbackWalkItemExercise,
  type ReplayTries,
} from "@/lib/willab/feedbackWalkModel";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import type { PractiseCard } from "@/lib/willab/paragraphOverlay";
import { clearerPieces } from "@/lib/willab/clearerPieces";
import { phraseSelection, quoteSpan } from "@/lib/willab/phraseTokens";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { PRAISE_LEAD, praiseLines } from "@/lib/willab/trackedChangeWhy";
import { practiseOfferedNow, readPractiseOffered } from "@/services/api/consentChoices";
import type { CoachMessage, DocumentSuggestion } from "@/services/api/idealText";
import { suggestionSource, walkPractiseIO } from "@/services/api/walkPractise";
import { fetchConfidencePractice } from "@/services/api/confidentVoicePractice";
import { practiceTries, threadTries } from "@/lib/willab/walkTries";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { reportMomentEvent } from "@/services/api/momentEvents";
import { lineBankIO } from "@/services/api/lineBank";
import {
  markCoachFeedbackSeen,
  shownKey,
  type CoachFeedbackShown,
} from "@/services/api/coachFeedbackSeen";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { LockResult } from "./DeckChunkModal";
import { praiseTitleFor } from "@/lib/willab/praiseLevels";

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
/*    tapPart(id)   a paragraph with an open moment was tapped: open the walk */
/*                  at that moment (Q-B3 A). False otherwise.                 */
/*    replayPart(id) a paragraph whose moments are answered was tapped, or   */
/*                  its helper words: the walk played again from that         */
/*                  paragraph (founder 2026-10-10, "the journey should be     */
/*                  unified"). False when it has no moment, and the deck      */
/*                  opens the paragraph's own sheet.                          */
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
  const lead = item.tentative ? CHUNK_SHEET_COPY.praiseTentative : PRAISE_LEAD;
  return [lead, ...praiseLines(item.cueKeys ?? [])];
}

function slideOf(groups: readonly SlideGroup[], partId: string): number | null {
  const group = groups.find((g) => g.chunks.some((c) => c.part.id === partId));
  return group ? group.slideIndex : null;
}

/** The Take's open feedback, as the walk reads it: every item still waiting
 *  on a paragraph whose bar is up. Pure. */
export function deckWalkItems(
  chunks: readonly DeckChunk[],
  groups: readonly SlideGroup[],
  waiting: (chunk: DeckChunk) => boolean,
  pendingOf: (chunk: DeckChunk) => readonly DocumentSuggestion[],
  slideLabel: (partId: string) => string | null,
): FeedbackWalkItem<DocumentSuggestion>[] {
  const seen = new Set<string>();
  const out: FeedbackWalkItem<DocumentSuggestion>[] = [];
  for (const chunk of chunks) {
    const partId = chunk.part.id;
    if (seen.has(partId) || !waiting(chunk)) continue;
    seen.add(partId);
    const slide = slideOf(groups, partId) ?? 0;
    for (const item of pendingOf(chunk)) out.push(walkItemOf(item, chunk, slide, slideLabel(partId)));
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
      out.push(walkItemOf(item, chunk, slide, slideLabel(partId)));
    }
  }
  return out;
}

/** The screens a moment's coach answer is drawn on. */
/** How long a step tapped in the Lounge waits on the replay's reads. */
const REPLAY_WAIT_MS = 4000;

const COACH_ANSWER_STEPS: ReadonlySet<string> = new Set(["coach", "praise", "clearer", "exVideo"]);

/** The machine's answers on a try, posted as the try is made. */
const TRY_ANSWER_STEPS: ReadonlySet<string> = new Set(["improved", "encourage", "thanks"]);

/** One served item as the walk reads it. Pure. */
function walkItemOf(
  item: DocumentSuggestion,
  chunk: DeckChunk,
  slide: number,
  label: string | null,
): FeedbackWalkItem<DocumentSuggestion> {
  const tiered = item.bookmarkTier != null;
  const green = item.bookmarkTier === "confident";
  const praise = tiered ? green : item.openCard === "praise" || item.feedbackFamily === "great_formulation";
  const exercise = exerciseOf(item);
  const rewrite = rewriteOf(item);
  return {
    start: item.start,
    slide,
    blockId: item.blockId ?? null,
    hasRewrite: rewrite !== null,
    ...(tiered ? { tiered, green, practicePrompt: item.practicePrompt === true } : {}),
    openCard: item.openCard ?? null,
    feedbackFamily: item.feedbackFamily ?? null,
    hasExercise: exercise !== null,
    partId: chunk.part.id,
    paragraphText: chunk.part.text,
    slideLabel: label,
    praiseWords: praise ? praiseWordsOf(item) : null,
    praiseTitle: praise ? praiseTitleFor(item.levelKey, item.id) : null,
    clip: item.snippetAudioRef
      ? { src: item.snippetAudioRef, startOffsetMs: item.startOffsetMs, durationMs: item.durationMs, snippetId: item.snippetId }
      : null,
    rewrite,
    item: suggestionSource(item) ? item : null,
    exercise,
    judge: reopensJudgement(item) ? item : null,
    ...(item.coachAnswer ? { coachAnswered: true, coachAnswer: item.coachAnswer, coachItem: item } : {}),
  };
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
  return { quote: item.quote, proposedText: item.proposedText, move: item.rewriteMove, item, decided };
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
 *  (D-FW-19; backend 0439): the Take's coach note on its screen; on a
 *  moment's screen, the moment itself, once per snippet, from every item the
 *  moment carries and every item still open on its paragraphs. Pure. */
export function coachShownOn(
  step: WalkStep,
  moment: FeedbackWalkMoment<DocumentSuggestion> | null,
  coach: CoachMessage | null,
  openOn: readonly DocumentSuggestion[] = [],
): CoachFeedbackShown[] {
  if (step.key === "coachnote") {
    return coach?.takeSessionId ? [{ takeSessionId: coach.takeSessionId }] : [];
  }
  if (!moment) return [];
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
  /** The answered items on a paragraph (the replay reads them with the
   *  waiting ones, Q-IT643b A). */
  answeredOf?: (chunk: DeckChunk) => readonly DocumentSuggestion[];
  /** The helper words saved on a paragraph, drawn pressed in the replay. */
  helperWordsOf?: (partId: string) => string | null;
  /** Nothing of this Take waits on the speaker: the walk is finished, and
   *  "Review feedback" under "Record Take N" plays it again. */
  finished?: boolean;
  /** The Take's moments may still land (the readout is not in yet). */
  feedbackPending?: boolean;
}): {
  review: (target?: WalkStepTarget | null) => boolean;
  tapPart: (partId: string, open: boolean) => boolean;
  /** A paragraph's helper words were tapped: that slide's helper-words step
   *  in the same walk, live or finished (lock 2026-10-12, section 4). False
   *  when the paragraph has none. */
  openHelpers: (partId: string) => boolean;
  /** Plays the walk again from this paragraph's first moment. False when
   *  the paragraph has none in the replay. */
  replayPart: (partId: string) => boolean;
  /** The paragraph has a moment of this Take to open (its bookmark). */
  hasMoment: (partId: string) => boolean;
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
  element: ReactNode;
} {
  const { chunks, groups, waiting, pendingOf, slideLabel, coachMessage, coachSeen, firstTake } = args;
  const { answeredOf, helperWordsOf, finished = false } = args;
  const practiceOn = usePracticeOn();
  const journal = useWalkJournalPost(true);
  const pageTake = args.takeSessionId ?? null;

  const items = useMemo(
    () => deckWalkItems(chunks, groups, waiting, pendingOf, slideLabel),
    [chunks, groups, waiting, pendingOf, slideLabel],
  );
  const take = useMemo(() => reviewedTake(items, pageTake), [items, pageTake]);
  /* EVERY STEP IS A LOUNGE MESSAGE (founder lock 2026-10-12, section 1):
     what the walk shows and what the speaker answers, stored once, behind
     the screen. A failed post never stops the walk. */
  const thread = useLoungeThreadMaybe();
  const live = useRef(args);
  live.current = args;
  const threadRef = useRef({ thread, take, arcId: args.arcId ?? null });
  threadRef.current = { thread, take, arcId: args.arcId ?? null };
  // What the closing summary hears (lock 2026-10-12, section 3).
  const heardRef = useRef<{ practice: "better" | "not_yet" | null; words: string[] }>({ practice: null, words: [] });
  const post = useCallback((entry: Omit<WalkThreadEntry, "take" | "arcId">) => {
    const heard = heardRef.current;
    if (entry.key === "improved") heard.practice = "better";
    if ((entry.key === "thanks" || entry.key === "encourage") && heard.practice !== "better") heard.practice = "not_yet";
    if (entry.author === "speaker" && (entry.key.startsWith("words:") || entry.key.startsWith("try-words:"))) {
      heard.words = [...heard.words.filter((w) => w !== entry.body), entry.body].slice(-2);
    }
    const { thread: to, take: on, arcId } = threadRef.current;
    if (!to || !on || (entry.key !== "end" && !entry.extra?.clip && !entry.body.trim())) return;
    const takeIndex = live.current.takeIndex ?? null;
    void to.append(walkStepDraft({ ...entry, take: on, arcId, takeIndex })).catch(() => undefined);
  }, []);
  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items,
        coachNote: coachMessage !== null,
        coachOnly: args.coachOnly === true,
        practiceOn,
        guest: false,
      }),
    [items, coachMessage, practiceOn, args.coachOnly],
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
        ? deckReplayItems(chunks, groups, (c) => [...pendingOf(c), ...answeredOf(c)], slideLabel)
        : [],
    [replayReady, answeredOf, chunks, groups, pendingOf, slideLabel],
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
  const [triedByPractice, setTriedByPractice] = useState<Readonly<Record<string, ReplayTries | null>>>({});
  const askedPractices = useRef(new Set<string>());
  useEffect(() => {
    if (!replayReady || (thread !== null && !threadLoaded)) return;
    for (const item of replayItems) {
      const practiceId = practiceIdOf(item);
      if (!practiceId || triedByPart.has(item.partId) || askedPractices.current.has(practiceId)) continue;
      askedPractices.current.add(practiceId);
      void fetchConfidencePractice(practiceId)
        .then((r) => (r.ok ? practiceTries(r.practice) : null))
        .catch(() => null)
        .then((tries) => setTriedByPractice((t) => ({ ...t, [practiceId]: tries })));
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
        answerOf: (item) => latestAnswerOf(item.id, answers),
        helperWordsOf: (partId) => helperWordsOf?.(partId) ?? null,
        triesOf: (moment) => {
          const fromThread = triedByPart.get(moment.partId);
          if (fromThread) return fromThread;
          const practiceId = momentPracticeId(moment);
          return practiceId ? (triedByPractice[practiceId] ?? null) : null;
        },
      }),
    [replayItems, replayReady, coachMessage, practiceOn, helperWordsOf, triedByPart, triedByPractice],
  );
  // The tries can land while the answers are read: the newest build.
  const buildReplayRef = useRef(buildReplay);
  buildReplayRef.current = buildReplay;
  const canReplay = useMemo(
    () => replayable && walkStart(buildReplay(ownAnswers)) !== null,
    [replayable, buildReplay, ownAnswers],
  );
  // The model the walk is opened on: the replay's while it plays.
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
  const openAt = useCallback((at: number | null, practising = false, lens = false, how?: WalkDir): boolean => {
    if (at === null) return false;
    practisingRef.current = practising;
    lensRef.current = lens;
    toldRef.current = new Set<string>();
    seqRef.current += 1;
    setRequest({ seq: seqRef.current, at, how });
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
  // A helper-words bubble opens that paragraph's helper words, as a tap on
  // the words in the text does (founder 2026-10-14).
  const openHelpersRef = useRef<(partId: string) => boolean>(() => false);
  const review = useCallback((target?: WalkStepTarget | null): boolean => {
    if (otherTake(target)) return true;
    if (target?.step === "helpers" && target.part && openHelpersRef.current(target.part)) return true;
    setReplaying(null);
    const liveAt = walkStepAt(model, target);
    // An answered step opens as given, read-only (prototype v31).
    const done = target && liveAt === null && replayReady ? buildReplay(ownAnswers) : null;
    const doneAt = done ? walkStepAt(done, target) : null;
    if (done && doneAt !== null) {
      setReplaying(done);
      return openAt(doneAt, false, true);
    }
    const opened = openAt(liveAt ?? walkStart(model), false, true);
    if (opened && model.plan.some((step) => step.key === "coachnote")) coachSeenRef.current();
    return opened;
  }, [model, openAt, otherTake, replayReady, buildReplay, ownAnswers]);

  const tapPart = useCallback(
    (partId: string, open: boolean): boolean => {
      if (!open) return false;
      setReplaying(null);
      return openAt(walkStepForPart(model, partId));
    },
    [model, openAt],
  );

  const replay = useCallback((target?: WalkStepTarget | null): boolean => {
    if (otherTake(target)) return true;
    if (target?.step === "helpers" && target.part && openHelpersRef.current(target.part)) return true;
    if (!canReplay) return false;
    void ownAnswersOf(pageTake).then((answers) => {
      const again = buildReplayRef.current(answers);
      const at = walkStepAt(again, target) ?? walkStart(again);
      if (at === null) return;
      setOwnAnswers(answers);
      setReplaying(again);
      openAt(at, false, true);
    });
    return true;
  }, [canReplay, pageTake, openAt, otherTake]);

  // The paragraph has a moment of this Take to open, waiting or answered:
  // only such a paragraph wears the bookmark (founder 2026-10-14).
  const replayNow = useMemo(() => (replayReady ? buildReplay(ownAnswers) : null), [replayReady, buildReplay, ownAnswers]);
  const hasMoment = useCallback(
    (partId: string): boolean =>
      walkStepForPart(model, partId) !== null || (replayNow !== null && walkStepForPart(replayNow, partId) !== null),
    [model, replayNow],
  );

  const replayPart = useCallback(
    (partId: string): boolean => {
      if (!replayReady) return false;
      const now = buildReplay(ownAnswers);
      const at = walkStepForPart(now, partId);
      if (at === null) return false;
      setReplaying(now);
      openAt(at);
      return true;
    },
    [replayReady, buildReplay, ownAnswers, openAt],
  );

  const openHelpers = useCallback(
    (partId: string): boolean => {
      // The live walk's step while the paragraph still waits; else the
      // finished walk's, where the words stay editable.
      const liveAt = walkHelpersForPart(model, partId);
      if (liveAt !== null) {
        setReplaying(null);
        return openAt(liveAt);
      }
      const now = replayReady ? buildReplay(ownAnswers) : null;
      const at = now ? walkHelpersForPart(now, partId) : null;
      if (now && at !== null) {
        setReplaying(now);
        return openAt(at);
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
    [model, replayReady, buildReplay, ownAnswers, openAt],
  );
  openHelpersRef.current = openHelpers;

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
    const words = stripRichMarkers(save.span.text);
    post({ key: `words:${save.partId}:${words}`, moment: null, attempt: null, author: "speaker", body: words, extra: { words_of: save.partId } });
    const { chunks: now, setRootPhrase, lockPart, saveBehind } = live.current;
    const chunk = now.find((c) => c.part.id === save.partId);
    if (!chunk) return;
    const span = spanOnLiveText(save, chunk.part.text);
    // The words already saved, pressed again: nothing to write.
    if (span && sameHelperWords(span.text, live.current.helperWordsOf?.(save.partId))) return;
    saveBehind(
      async () => (span ? helperWordsBehind(setRootPhrase, lockPart, chunk, span) : "final"),
      CHUNK_SHEET_COPY.failWordsBehind,
    );
  }, [post]);
  const acceptClearer = useCallback((item: DocumentSuggestion) => {
    post({ key: `clearer:${item.id}`, moment: null, attempt: null, author: "speaker", body: CHUNK_SHEET_COPY.pillAcceptPractise });
    const { onAccept, saveBehind } = live.current;
    saveBehind(() => acceptRewriteBehind(onAccept, item), CHUNK_SHEET_COPY.failApply);
  }, [post]);
  const keepWords = useCallback((item: DocumentSuggestion) => {
    post({ key: `clearer:${item.id}`, moment: null, attempt: null, author: "speaker", body: CHUNK_SHEET_COPY.linkKeepMyWords });
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
    // Each try, once uploaded, is the speaker's orange bubble "Practise N"
    // with its voice (prototype v31 `try`); the practice and attempt ids
    // find the signed link again.
    const upload: typeof io.upload = async (practiceId, ...rest) => {
      const sent = await io.upload(practiceId, ...rest);
      if (sent) {
        const on = openedOn.get(practiceId) ?? { moment: null, part_id: null };
        post({
          key: `try:${practiceId}`,
          moment: on.moment,
          attempt: sent.attempt,
          author: "speaker",
          body: WALK_COPY.practiseN(sent.attempt),
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
  // skipped.
  const summary = useCallback(async (): Promise<string | null> => {
    const { thread: to, take: on, arcId } = threadRef.current;
    if (!on || !arcId) return null;
    const heard = heardRef.current;
    const text = await postReviewSummaryText(arcId, {
      takeSessionId: on,
      practice: heard.practice,
      helperWords: heard.words,
      coachNote: live.current.coachMessage?.text ?? null,
    });
    if (text) void to?.reload();
    return text;
  }, []);
  // A paragraph's practise ends on the page quietly; the review's end tells
  // the Lounge ("Continue review" leaves it) and lands on the Ideal Text.
  // The review's end is written once per Take, also when the walk closes
  // with nothing left to answer, so "Continue review" goes (founder 2026-10-14).
  const endedRef = useRef<string | null>(null);
  const postEnd = useCallback(() => {
    const { thread: to, take: on } = threadRef.current;
    if (!on || endedRef.current === on) return;
    endedRef.current = on;
    const written = to?.messages.some(
      (m) => m.kind === "walk_step" && m.metadata?.step === "end" && m.metadata?.take_session_id === on,
    );
    if (!written) post({ key: "end", moment: null, attempt: null, author: "app", body: "" });
  }, [post]);
  const ended = finished && !args.feedbackPending && thread !== null && !thread.loading;
  useEffect(() => {
    if (ended && request === null) postEnd();
  }, [ended, request, postEnd]);
  const onEnd = useCallback(() => {
    // A paragraph's own practise or helper words end nothing either, but
    // the page still hears it: a lens opened on them shows the text then.
    // The coach-only walk is not the review: it ends nothing.
    if (!practisingRef.current && !live.current.coachOnly) postEnd();
    live.current.onEnd?.();
  }, [postEnd]);
  const onClose = useCallback(() => {
    if (!practisingRef.current && live.current.finished && !live.current.feedbackPending) postEnd();
    if (lensRef.current) live.current.onLensClose?.();
    live.current.onWalkClose?.();
  }, [postEnd]);
  // NEXT GOES TO WHAT STILL WAITS (founder 2026-10-14, walk first): on a
  // step played again, while a moment of this Take still waits, Next goes
  // to the live walk's first waiting step; with nothing waiting it plays on.
  const onForward = useCallback((): boolean => {
    if (!replaying || items.length === 0) return false;
    const at = walkStart(model);
    if (at === null) return false;
    setReplaying(null);
    openAt(at, false, lensRef.current);
    return true;
  }, [replaying, items.length, model, openAt]);
  // ‹ › BROWSE EVERY SCREEN OF THE WALK (founder 2026-10-15, "one bar for the
  // whole walk"): answered and waiting alike, across slides, in walk order.
  // The replay holds every moment of the Take in that order, so it is the
  // order; a screen the live walk still holds opens live (its pill answers
  // it), the rest open as answered. The arrows never answer and never close:
  // at the walk's first and last screen they are off. The closing summary is
  // reached only once nothing waits (it is written when it is read). A
  // paragraph's own practise or helper words, and the coach-only walk,
  // browse their own screens.
  const browse = useCallback(
    (step: WalkStep, partId: string | null, dir: WalkBrowseDir): WalkHop | null => {
      const shown = replaying ?? model;
      const whole = practisingRef.current || live.current.coachOnly || !replayNow ? shown : replayNow;
      const from: WalkStepTarget = { step: step.key, moment: null, part: partId ?? undefined };
      let order = whole;
      let here = walkStepAt(order, from);
      if (here === null) {
        order = shown;
        here = walkStepAt(order, from);
      }
      if (here === null) return null;
      const to = walkBrowseFrom(order.plan, here, dir);
      if (to === null) return null;
      const next = order.plan[to];
      if (next.key === "summary" && items.length > 0) return null;
      const target: WalkStepTarget = {
        step: next.key,
        moment: null,
        part: next.moment == null ? undefined : order.moments[next.moment]?.partId,
      };
      const liveAt = order === model ? to : order === replayNow ? walkStepAt(model, target) : null;
      return {
        target,
        live: liveAt !== null,
        open: () => {
          setReplaying(liveAt === null ? order : null);
          openAt(liveAt ?? to, false, lensRef.current, dir);
        },
      };
    },
    [replaying, model, replayNow, items.length, openAt],
  );
  /** The walk showed the coach's note or a moment: the server hears it once
   *  per opening, behind the screen, and the Lounge's "new" clears. */
  const onShown = useCallback(
    (
      step: WalkStep,
      moment: FeedbackWalkMoment<DocumentSuggestion> | null,
      say: (bank: WalkBankKey) => string,
      ai?: WalkAiShown | null,
    ) => {
      const { chunks: now, pendingOf: openOf, coachMessage: coach } = live.current;
      const at = { moment: step.moment ?? null, attempt: step.attempt ?? null };
      // The AI bubble in the locked one's place (N71) says what the screen said.
      const aiSaid = ai ? aiVoiceChat(ai) : null;
      // A try's answer played again was said once, as the try was made.
      const replayedTry = step.replay === true && TRY_ANSWER_STEPS.has(step.key);
      let said = replayedTry ? null : (aiSaid ?? shownStep(step, moment, coach?.text ?? null, say));
      // The coach's video as a thumb in their bubble (prototype v31).
      if (step.key === "coachnote" && coach?.videoUrl) {
        said = { author: "coach", body: said?.body ?? CHUNK_SHEET_COPY.titleCoach, extra: { video: coach.videoUrl } };
      }
      // The label above a moment, and the speaker's clip before its bubble.
      const chat = said ? momentChat(walkModel.plan, step, moment) : null;
      // The moment's paragraph: a tap in the chat finds the step by it.
      const part = { part_id: moment?.partId ?? null };
      if (chat?.clip) post({ key: `clip:${step.key}`, ...at, author: "speaker", body: "", extra: { ...chat.label, clip: chat.clip, ...part } });
      if (said) post({ key: step.key, ...at, ...said, extra: { ...(chat?.clip ? {} : chat?.label), ...said.extra, ...part } });
      // The coach's answer on the moment: their bubble in the chat too.
      const answer = moment?.coachAnswer;
      if (answer && COACH_ANSWER_STEPS.has(step.key)) {
        post({ key: "coach-answer", moment: at.moment, attempt: null, author: "coach", body: `${CHUNK_SHEET_COPY.titleCoach}\n${answer.text}`, extra: { ...(answer.videoUrl ? { video: answer.videoUrl } : {}), ...part } });
      }
      const parts = moment ? (walkModel.partsOf[moment.index] ?? []) : [];
      const openOn = now.filter((c) => parts.includes(c.part.id)).flatMap((c) => openOf(c));
      for (const shown of coachShownOn(step, moment, coach, openOn)) {
        const key = shownKey(shown);
        if (toldRef.current.has(key)) continue;
        toldRef.current.add(key);
        void markCoachFeedbackSeen(shown);
      }
    },
    [walkModel, post],
  );

  /** Another speaker's moment, shown or answered: in the chat. */
  const onOthers = useCallback(
    (at: number, of: number, from: string | null, answer: string | null) => {
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
    },
    [post, walkModel],
  );

  const element = useMemo(
    () => (
        <FeedbackWalk
          model={walkModel}
          request={request}
          coachNote={coachMessage}
          firstTake={firstTake}
          takeIndex={args.takeIndex ?? null}
          onSaveHelperWords={saveHelperWords}
          onAcceptClearer={acceptClearer}
          onKeepWords={keepWords}
          practise={practise}
          onJudge={judge}
          onSkipJudging={skipJudging}
          journal={journal}
          summary={summary}
          onEnd={onEnd}
          onForward={onForward}
          browse={browse}
          onClose={onClose}
          lines={lineBankIO}
          onShown={onShown}
          onAnswer={onAnswer}
          onOthers={onOthers}
        />
    ),
    [
      walkModel,
      request,
      coachMessage,
      firstTake,
      args.takeIndex,
      summary,
      saveHelperWords,
      acceptClearer,
      keepWords,
      practise,
      judge,
      skipJudging,
      journal,
      onEnd,
      onForward,
      browse,
      onClose,
      onShown,
      onAnswer,
      onOthers,
    ],
  );

  return useMemo(
    () => ({ review, tapPart, openHelpers, replayPart, hasMoment, replay, canReplay, replaySettled, practisePart, element }),
    [review, tapPart, openHelpers, replayPart, hasMoment, replay, canReplay, replaySettled, practisePart, element],
  );
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
