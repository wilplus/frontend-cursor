"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import FeedbackWalk, {
  type FeedbackWalkHelperWords,
  type FeedbackWalkPractiseWords,
  type FeedbackWalkRequest,
} from "./walk/FeedbackWalk";
import type { WalkJudgementSave } from "./walk/useWalkJudging";
import { useWalkJournalPost } from "./useWalkJournalPost";
import { noteOwnAnswer } from "./paragraphSheetData";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import {
  acceptRewriteBehind,
  helperWordsBehind,
  keepWordsBehind,
  practiseWordsBehind,
  type SaveBehind,
} from "./saveBehind";
import { feedbackWalkOn } from "@/lib/willab/feedbackWalkSwitch";
import { answerChanged, reopensJudgement } from "@/lib/willab/changeJudgement";
import { judgedStatus } from "@/lib/willab/chunkSteps";
import {
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
/*                  at that moment (Q-B3 A). False otherwise, and the deck    */
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
    const slide = slideOf(groups, partId);
    for (const item of pendingOf(chunk)) {
      const praise = item.openCard === "praise" || item.feedbackFamily === "great_formulation";
      const exercise = exerciseOf(item);
      out.push({
        start: item.start,
        slide: slide ?? 0,
        blockId: item.blockId ?? null,
        openCard: item.openCard ?? null,
        feedbackFamily: item.feedbackFamily ?? null,
        hasExercise: exercise !== null,
        partId,
        paragraphText: chunk.part.text,
        slideLabel: slideLabel(partId),
        praiseWords: praise ? praiseWordsOf(item) : null,
        clip: item.snippetAudioRef
          ? { src: item.snippetAudioRef, startOffsetMs: item.startOffsetMs, durationMs: item.durationMs }
          : null,
        rewrite: rewriteOf(item),
        item: suggestionSource(item) ? item : null,
        exercise,
        judge: reopensJudgement(item) ? item : null,
      });
    }
  }
  return out;
}

/** A served rewrite the walk can draw and decide: a replace with words to
 *  offer, from the clearer-version family or routed to the rewrite card.
 *  The same fields the Feedback sheet's rewrite card shows. Pure. */
export function rewriteOf(item: DocumentSuggestion): FeedbackWalkItem<DocumentSuggestion>["rewrite"] {
  if (item.kind !== "replace" || !item.proposedText?.trim()) return null;
  if (item.feedbackFamily !== "rewrite_clarity" && item.openCard !== "rewrite") return null;
  return { quote: item.quote, proposedText: item.proposedText, item };
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
}): { review: () => boolean; tapPart: (partId: string, open: boolean) => boolean; element: ReactNode } {
  const { chunks, groups, waiting, pendingOf, slideLabel, coachMessage, coachSeen, firstTake } = args;
  // Read after mount: the address is not there on the server render.
  const [on, setOn] = useState(false);
  useEffect(() => setOn(feedbackWalkOn()), []);
  const practiceOn = usePracticeOn(on);
  const journal = useWalkJournalPost(on);

  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items: on ? deckWalkItems(chunks, groups, waiting, pendingOf, slideLabel) : [],
        coachNote: on && coachMessage !== null,
        practiceOn,
        guest: false,
      }),
    [on, chunks, groups, waiting, pendingOf, slideLabel, coachMessage, practiceOn],
  );

  const seqRef = useRef(0);
  const [request, setRequest] = useState<FeedbackWalkRequest | null>(null);
  const openAt = useCallback((at: number | null): boolean => {
    if (at === null) return false;
    seqRef.current += 1;
    setRequest({ seq: seqRef.current, at });
    return true;
  }, []);

  const coachSeenRef = useRef(coachSeen);
  coachSeenRef.current = coachSeen;
  const review = useCallback((): boolean => {
    if (!on) return false;
    const opened = openAt(walkStart(model));
    if (opened && model.plan.some((step) => step.key === "coachnote")) coachSeenRef.current();
    return opened;
  }, [on, model, openAt]);

  const tapPart = useCallback(
    (partId: string, open: boolean): boolean => {
      if (!on || !open) return false;
      return openAt(walkStepForPart(model, partId));
    },
    [on, model, openAt],
  );

  const live = useRef(args);
  live.current = args;
  const saveHelperWords = useCallback((save: FeedbackWalkHelperWords) => {
    const { chunks: now, setRootPhrase, lockPart, saveBehind } = live.current;
    const chunk = now.find((c) => c.part.id === save.partId);
    if (!chunk) return;
    const span = spanOnLiveText(save, chunk.part.text);
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

  const element = useMemo(
    () =>
      on ? (
        <FeedbackWalk
          model={model}
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
          onEnd={onEnd}
        />
      ) : null,
    [
      on,
      model,
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
      onEnd,
    ],
  );

  return useMemo(() => ({ review, tapPart, element }), [review, tapPart, element]);
}
