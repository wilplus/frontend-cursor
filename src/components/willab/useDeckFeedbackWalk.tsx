"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import FeedbackWalk, {
  type FeedbackWalkHelperWords,
  type FeedbackWalkPractiseWords,
  type FeedbackWalkRequest,
} from "./walk/FeedbackWalk";
import type { WalkJudgementSave } from "./walk/useWalkJudging";
import { useWalkJournalPost } from "./useWalkJournalPost";
import { noteOwnAnswer, ownAnswersOf } from "./paragraphSheetData";
import type { OwnerAnswer } from "@/services/api/bookmarkHistory";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import {
  acceptRewriteBehind,
  helperWordsBehind,
  keepWordsBehind,
  practiseWordsBehind,
  type SaveBehind,
} from "./saveBehind";
import { feedbackWalkOn } from "@/lib/willab/feedbackWalkSwitch";
import { answerChanged, latestAnswerOf, reopensJudgement } from "@/lib/willab/changeJudgement";
import { judgedStatus } from "@/lib/willab/chunkSteps";
import {
  buildFeedbackReplay,
  buildFeedbackWalk,
  walkStart,
  walkStepForPart,
  type FeedbackWalkItem,
  type FeedbackWalkItemExercise,
} from "@/lib/willab/feedbackWalkModel";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { quoteSpan } from "@/lib/willab/phraseTokens";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { PRAISE_LEAD, praiseLines } from "@/lib/willab/trackedChangeWhy";
import { practiseOfferedNow, readPractiseOffered } from "@/services/api/consentChoices";
import type { CoachMessage, DocumentSuggestion } from "@/services/api/idealText";
import { savePracticeHelperWords } from "@/services/api/confidentVoicePractice";
import { suggestionSource, walkPractiseIO } from "@/services/api/walkPractise";
import { saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
import { reportMomentEvent } from "@/services/api/momentEvents";
import { createCommunity, fetchCommunities, joinCommunity, shareTake } from "@/services/api/communities";
import type { ShareIO } from "@/lib/willab/walkShare";
import { lineBankIO } from "@/services/api/lineBank";
import {
  markCoachFeedbackSeen,
  shownKey,
  type CoachFeedbackShown,
} from "@/services/api/coachFeedbackSeen";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { LockResult } from "./DeckChunkModal";

/* -------------------------------------------------------------------------- */
/*  The Feedback walk on the Ideal Text page, behind its one switch (build     */
/*  plan D-FW-14; feedbackWalkOn).                                             */
/*                                                                            */
/*  The deck asks two questions and draws one element:                        */
/*    review()      "Review feedback" was tapped: open the walk on its first   */
/*                  screen (the coach's note, else the first praise). False   */
/*                  when the switch is off or this phase has nothing to show, */
/*                  and the deck goes on exactly as today.                    */
/*    tapPart(id)   a paragraph with an open moment was tapped: open the walk */
/*                  at that moment (Q-B3 A). False otherwise.                 */
/*    replayPart(id) a paragraph whose moments are answered was tapped, or   */
/*                  its helper words: the walk played again from that         */
/*                  paragraph (founder 2026-10-10, "the journey should be     */
/*                  unified"). False when it has no moment, and the deck      */
/*                  opens the paragraph's own sheet as today.                 */
/*    element       the walk itself; null while the switch is off.           */
/*                                                                            */
/*  With the switch off nothing is read, nothing is fetched and nothing is    */
/*  drawn: the deck behaves exactly as it did. Its own hook so the deck gains */
/*  a line, not a branch (the complexity ratchet).                            */
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
/*  evidence (walkPractiseIO), the same routes today's practise sheet uses;   */
/*  helper words from a praised try go on the practice, then the lock, behind */
/*  the screen (`practiseWordsBehind`). An exercise (D-FW-17) is the served   */
/*  offer the Feedback sheet's Exercise step plays: its video (the coach's,   */
/*  else the library's), its instruction and its words (`exerciseOf`).        */
/*                                                                            */
/*  The judgements (D-FW-18) are saved as the Feedback sheet saves them: the  */
/*  speaker's own answer on the Confident Voice item (L3), through the        */
/*  feedback-response route, behind the screen; a changed answer is saved     */
/*  beside the first (200 `revised`, QA1 A) and the same answer sends nothing */
/*  (`judgementBehind`). Its bar leaves the page at once (`onJudged`). Skip   */
/*  on "Judgement time!" settles every unanswered moment as the paragraph     */
/*  sheet's Skip does: a `skipped` moment event (0408), and the bar leaves at */
/*  once. The Journal post the intro links to is the published self-modeling */
/*  post (JP1 A), read only while the switch is on.                           */
/*                                                                            */
/*  Sharing (D-FW-20) is asked after the review only while the server's      */
/*  communities answer (COMMUNITIES_ENABLED; off, every community route is   */
/*  404 and the walk goes straight to the end card, as before) and there is */
/*  a Take to share: the reviewed Take, the one its feedback items name,     */
/*  else the page's. Its calls are the communities routes (shareIO).         */
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

/** One served item as the walk reads it. Pure. */
function walkItemOf(
  item: DocumentSuggestion,
  chunk: DeckChunk,
  slide: number,
  label: string | null,
): FeedbackWalkItem<DocumentSuggestion> {
  const praise = item.openCard === "praise" || item.feedbackFamily === "great_formulation";
  const exercise = exerciseOf(item);
  return {
    start: item.start,
    slide,
    blockId: item.blockId ?? null,
    openCard: item.openCard ?? null,
    feedbackFamily: item.feedbackFamily ?? null,
    hasExercise: exercise !== null,
    partId: chunk.part.id,
    paragraphText: chunk.part.text,
    slideLabel: label,
    praiseWords: praise ? praiseWordsOf(item) : null,
    clip: item.snippetAudioRef
      ? { src: item.snippetAudioRef, startOffsetMs: item.startOffsetMs, durationMs: item.durationMs }
      : null,
    rewrite: rewriteOf(item),
    item: suggestionSource(item) ? item : null,
    exercise,
    judge: reopensJudgement(item) ? item : null,
  };
}

/** A served rewrite the walk can draw and decide: a replace with words to
 *  offer, from the clearer-version family or routed to the rewrite card.
 *  The same fields the Feedback sheet's rewrite card shows, its signed move
 *  (`rewriteMove`) among them: the line above the words to say. Pure. */
export function rewriteOf(item: DocumentSuggestion): FeedbackWalkItem<DocumentSuggestion>["rewrite"] {
  if (item.kind !== "replace" || !item.proposedText?.trim()) return null;
  if (item.feedbackFamily !== "rewrite_clarity" && item.openCard !== "rewrite") return null;
  return { quote: item.quote, proposedText: item.proposedText, move: item.rewriteMove, item };
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
  if (item.openCard !== "exercise" && offer.chosenByCoach !== true) return null;
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

/** The sharing screen's calls on one Take: join or set up a community by
 *  its pass code, then the share, which carries the words version (0443). */
export function shareIO(takeSessionId: string): ShareIO {
  return {
    join: async (passCode) => {
      const res = await joinCommunity(passCode);
      return res.ok ? { ok: true, data: { id: res.data.id } } : res;
    },
    create: async (name, passCode) => {
      const res = await createCommunity(name, passCode);
      return res.ok ? { ok: true, data: { id: res.data.id } } : res;
    },
    share: (choice) => shareTake(takeSessionId, choice),
  };
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

/** Sharing is on while the server's communities answer: read once, only
 *  while the walk is on. A 404 (COMMUNITIES_ENABLED off) or a failure
 *  leaves it off. */
function useSharingOn(on: boolean): boolean {
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    if (!on) return;
    let live = true;
    void fetchCommunities().then((res) => {
      if (live) setSharing(res.ok);
    });
    return () => {
      live = false;
    };
  }, [on]);
  return sharing;
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

/** Personalised practice, read only while the walk is on (the deck makes no
 *  new read with the switch off). */
function usePracticeOn(on: boolean): boolean {
  const [offered, setOffered] = useState<boolean>(() => practiseOfferedNow() ?? true);
  useEffect(() => {
    if (!on) return;
    let live = true;
    void readPractiseOffered().then((value) => {
      if (live) setOffered(value);
    });
    return () => {
      live = false;
    };
  }, [on]);
  return offered;
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
  /** The page's Take, when the feedback items name none. */
  takeSessionId?: string | null;
  setRootPhrase: (chunk: DeckChunk, phrase: RootPhraseSpan | null) => Promise<boolean>;
  /** The deck's decision on a clearer version: the Feedback sheet's own. */
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  lockPart: (chunk: DeckChunk, text: string) => Promise<LockResult>;
  saveBehind: SaveBehind;
  /** A moment judged or skipped in the walk: its bar leaves the page at
   *  once, settled as the server settles it (the Feedback sheet's own). */
  onJudged?: (s: DocumentSuggestion, decided: "approved" | "dismissed") => void;
  /** The walk ran out: the deck's end card. */
  onEnd: () => void;
  /** The answered items on a paragraph (the replay reads them with the
   *  waiting ones, Q-IT643b A). */
  answeredOf?: (chunk: DeckChunk) => readonly DocumentSuggestion[];
  /** The helper words saved on a paragraph, drawn pressed in the replay. */
  helperWordsOf?: (partId: string) => string | null;
  /** Nothing of this Take waits on the speaker: the walk is finished, and
   *  "Review feedback" under "Record Take N" plays it again. */
  finished?: boolean;
}): {
  review: () => boolean;
  tapPart: (partId: string, open: boolean) => boolean;
  /** Plays the walk again from this paragraph's first moment. False when
   *  the paragraph has none in the replay. */
  replayPart: (partId: string) => boolean;
  /** Plays the finished walk again (Q-IT643b A). False when there is
   *  nothing to play. */
  replay: () => boolean;
  /** The finished walk has a screen to play again. */
  canReplay: boolean;
  element: ReactNode;
} {
  const { chunks, groups, waiting, pendingOf, slideLabel, coachMessage, coachSeen, firstTake } = args;
  const { answeredOf, helperWordsOf, finished = false } = args;
  // Read after mount: the address is not there on the server render.
  const [on, setOn] = useState(false);
  useEffect(() => setOn(feedbackWalkOn()), []);
  const practiceOn = usePracticeOn(on);
  const journal = useWalkJournalPost(on);
  const sharingOn = useSharingOn(on);
  const pageTake = args.takeSessionId ?? null;

  const items = useMemo(
    () => (on ? deckWalkItems(chunks, groups, waiting, pendingOf, slideLabel) : []),
    [on, chunks, groups, waiting, pendingOf, slideLabel],
  );
  const take = useMemo(() => reviewedTake(items, pageTake), [items, pageTake]);
  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items,
        coachNote: on && coachMessage !== null,
        practiceOn,
        guest: false,
        sharing: sharingOn && take !== null,
      }),
    [items, on, coachMessage, practiceOn, sharingOn, take],
  );
  const share = useMemo(() => (take ? shareIO(take) : null), [take]);

  /* THE FINISHED WALK, PLAYED AGAIN (founder 2026-10-08, Q-IT643b A): the
     Take's moments, answered or not, with the speaker's own answers (the
     sheets' read) and the helper words as saved. Read only while the switch
     is on and nothing waits. */
  // A paragraph is played again from its own moment at any time (founder
  // 2026-10-10); the whole walk, from "Review feedback", once it is finished.
  const replayReady = on && answeredOf !== undefined;
  const replayable = replayReady && finished;
  const [ownAnswers, setOwnAnswers] = useState<readonly OwnerAnswer[]>([]);
  useEffect(() => {
    if (!replayReady || !pageTake) return;
    let live = true;
    void ownAnswersOf(pageTake).then((answers) => {
      if (live) setOwnAnswers(answers);
    });
    return () => {
      live = false;
    };
  }, [replayReady, pageTake]);
  const buildReplay = useCallback(
    (answers: readonly OwnerAnswer[]) =>
      buildFeedbackReplay({
        items:
          replayReady && answeredOf
            ? deckReplayItems(chunks, groups, (c) => [...pendingOf(c), ...answeredOf(c)], slideLabel)
            : [],
        coachNote: replayReady && coachMessage !== null,
        practiceOn,
        answerOf: (item) => latestAnswerOf(item.id, answers),
        helperWordsOf: (partId) => helperWordsOf?.(partId) ?? null,
      }),
    [replayReady, answeredOf, chunks, groups, pendingOf, slideLabel, coachMessage, practiceOn, helperWordsOf],
  );
  const canReplay = useMemo(
    () => replayable && walkStart(buildReplay(ownAnswers)) !== null,
    [replayable, buildReplay, ownAnswers],
  );
  // The model the walk is opened on: the replay's while it plays.
  const [replaying, setReplaying] = useState<typeof model | null>(null);
  const walkModel = replaying ?? model;

  const seqRef = useRef(0);
  const [request, setRequest] = useState<FeedbackWalkRequest | null>(null);
  // What this opening of the walk already told the server (D-FW-19).
  const toldRef = useRef(new Set<string>());
  const openAt = useCallback((at: number | null): boolean => {
    if (at === null) return false;
    toldRef.current = new Set<string>();
    seqRef.current += 1;
    setRequest({ seq: seqRef.current, at });
    return true;
  }, []);

  const coachSeenRef = useRef(coachSeen);
  coachSeenRef.current = coachSeen;
  const review = useCallback((): boolean => {
    if (!on) return false;
    setReplaying(null);
    const opened = openAt(walkStart(model));
    if (opened && model.plan.some((step) => step.key === "coachnote")) coachSeenRef.current();
    return opened;
  }, [on, model, openAt]);

  const tapPart = useCallback(
    (partId: string, open: boolean): boolean => {
      if (!on || !open) return false;
      setReplaying(null);
      return openAt(walkStepForPart(model, partId));
    },
    [on, model, openAt],
  );

  const replay = useCallback((): boolean => {
    if (!canReplay) return false;
    void ownAnswersOf(pageTake).then((answers) => {
      const again = buildReplay(answers);
      const at = walkStart(again);
      if (at === null) return;
      setOwnAnswers(answers);
      setReplaying(again);
      openAt(at);
    });
    return true;
  }, [canReplay, pageTake, buildReplay, openAt]);

  const replayPart = useCallback(
    (partId: string): boolean => {
      if (!replayReady) return false;
      const now = withLiveHelperWords(buildReplay(ownAnswers));
      const at = walkStepForPart(now, partId);
      if (at === null) return false;
      setReplaying(now);
      openAt(at);
      return true;
    },
    [replayReady, buildReplay, ownAnswers, openAt],
  );

  const live = useRef(args);
  live.current = args;
  const saveHelperWords = useCallback((save: FeedbackWalkHelperWords) => {
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
  }, []);
  const acceptClearer = useCallback((item: DocumentSuggestion) => {
    const { onAccept, saveBehind } = live.current;
    saveBehind(() => acceptRewriteBehind(onAccept, item), CHUNK_SHEET_COPY.failApply);
  }, []);
  const keepWords = useCallback((item: DocumentSuggestion) => {
    const { onKeepMine, saveBehind } = live.current;
    saveBehind(() => keepWordsBehind(onKeepMine, item), CHUNK_SHEET_COPY.failKeep);
  }, []);
  const savePractiseWords = useCallback((save: FeedbackWalkPractiseWords) => {
    const { chunks: now, lockPart, saveBehind } = live.current;
    const chunk = now.find((c) => c.part.id === save.partId);
    if (!chunk) return;
    saveBehind(
      () =>
        practiseWordsBehind(
          (phrase) => savePracticeHelperWords(save.practiceId, save.partId, phrase),
          lockPart,
          chunk,
          save.phrase,
        ),
      CHUNK_SHEET_COPY.failWordsBehind,
    );
  }, []);
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
  const practise = useMemo(() => walkPractiseIO<DocumentSuggestion>(suggestionSource), []);
  const onEnd = useCallback(() => live.current.onEnd(), []);
  /** The walk showed the coach's note or a moment: the server hears it once
   *  per opening, behind the screen, and the Lounge's "new" clears. */
  const onShown = useCallback(
    (step: WalkStep, moment: FeedbackWalkMoment<DocumentSuggestion> | null) => {
      const { chunks: now, pendingOf: openOf, coachMessage: coach } = live.current;
      const parts = moment ? (walkModel.partsOf[moment.index] ?? []) : [];
      const openOn = now.filter((c) => parts.includes(c.part.id)).flatMap((c) => openOf(c));
      for (const shown of coachShownOn(step, moment, coach, openOn)) {
        const key = shownKey(shown);
        if (toldRef.current.has(key)) continue;
        toldRef.current.add(key);
        void markCoachFeedbackSeen(shown);
      }
    },
    [walkModel],
  );

  const element = useMemo(
    () =>
      on ? (
        <FeedbackWalk
          model={walkModel}
          request={request}
          coachNote={coachMessage}
          firstTake={firstTake}
          onSaveHelperWords={saveHelperWords}
          onAcceptClearer={acceptClearer}
          onKeepWords={keepWords}
          practise={practise}
          onSavePractiseWords={savePractiseWords}
          onJudge={judge}
          onSkipJudging={skipJudging}
          journal={journal}
          share={share}
          onEnd={onEnd}
          lines={lineBankIO}
          onShown={onShown}
        />
      ) : null,
    [
      on,
      walkModel,
      request,
      coachMessage,
      firstTake,
      saveHelperWords,
      acceptClearer,
      keepWords,
      practise,
      savePractiseWords,
      judge,
      skipJudging,
      journal,
      share,
      onEnd,
      onShown,
    ],
  );

  return useMemo(
    () => ({ review, tapPart, replayPart, replay, canReplay, element }),
    [review, tapPart, replayPart, replay, canReplay, element],
  );
}

/** The replay opened from a paragraph keeps its helper words live: the
 *  speaker may pick new ones there (L1: they persist until the speaker picks
 *  new ones), as the paragraph sheet allowed. Pure. */
export function withLiveHelperWords<M extends { plan: readonly WalkStep[] }>(model: M): M {
  return {
    ...model,
    plan: model.plan.map((step) => (step.key === "helpers" && step.replay ? { ...step, replay: false } : step)),
  };
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
  walk: { replay: () => boolean; canReplay: boolean },
  request: number | undefined,
  onReady: ((ready: boolean) => void) | undefined,
): void {
  const { canReplay, replay } = walk;
  useEffect(() => {
    onReady?.(canReplay);
  }, [canReplay, onReady]);
  const seenRef = useRef(request);
  useEffect(() => {
    if (request === seenRef.current) return;
    seenRef.current = request;
    replay();
  }, [request, replay]);
}
