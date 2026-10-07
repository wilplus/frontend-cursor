"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import FeedbackWalk, {
  type FeedbackWalkHelperWords,
  type FeedbackWalkRequest,
} from "./walk/FeedbackWalk";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import { helperWordsBehind, type SaveBehind } from "./saveBehind";
import { feedbackWalkOn } from "@/lib/willab/feedbackWalkSwitch";
import {
  buildFeedbackWalk,
  walkStart,
  walkStepForPart,
  type FeedbackWalkItem,
} from "@/lib/willab/feedbackWalkModel";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { quoteSpan } from "@/lib/willab/phraseTokens";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { PRAISE_LEAD, praiseLines } from "@/lib/willab/trackedChangeWhy";
import { practiseOfferedNow, readPractiseOffered } from "@/services/api/consentChoices";
import type { CoachMessage, DocumentSuggestion } from "@/services/api/idealText";
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
/*  screen (`helperWordsBehind` under `saveBehind`).                          */
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
): FeedbackWalkItem[] {
  const seen = new Set<string>();
  const out: FeedbackWalkItem[] = [];
  for (const chunk of chunks) {
    const partId = chunk.part.id;
    if (seen.has(partId) || !waiting(chunk)) continue;
    seen.add(partId);
    const slide = slideOf(groups, partId);
    for (const item of pendingOf(chunk)) {
      const praise = item.openCard === "praise" || item.feedbackFamily === "great_formulation";
      out.push({
        start: item.start,
        slide: slide ?? 0,
        blockId: item.blockId ?? null,
        openCard: item.openCard ?? null,
        feedbackFamily: item.feedbackFamily ?? null,
        hasExercise: Boolean(item.practiceExercise),
        partId,
        paragraphText: chunk.part.text,
        slideLabel: slideLabel(partId),
        praiseWords: praise ? praiseWordsOf(item) : null,
        clip: item.snippetAudioRef
          ? { src: item.snippetAudioRef, startOffsetMs: item.startOffsetMs, durationMs: item.durationMs }
          : null,
      });
    }
  }
  return out;
}

/** The span to save on the paragraph as it is now: the walk's own span when
 *  the words have not changed under it, else the same words found again;
 *  null when they cannot be found once (nothing is guessed). Pure. */
export function spanOnLiveText(save: FeedbackWalkHelperWords, liveText: string): RootPhraseSpan | null {
  if (liveText === save.paragraphText) return save.span;
  return quoteSpan(liveText, stripRichMarkers(save.span.text).trim());
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
  lockPart: (chunk: DeckChunk, text: string) => Promise<LockResult>;
  saveBehind: SaveBehind;
  /** The walk ran out: the deck's end card. */
  onEnd: () => void;
}): { review: () => boolean; tapPart: (partId: string, open: boolean) => boolean; element: ReactNode } {
  const { chunks, groups, waiting, pendingOf, slideLabel, coachMessage, coachSeen, firstTake } = args;
  // Read after mount: the address is not there on the server render.
  const [on, setOn] = useState(false);
  useEffect(() => setOn(feedbackWalkOn()), []);
  const practiceOn = usePracticeOn(on);

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
          onEnd={onEnd}
        />
      ) : null,
    [on, model, request, coachMessage, firstTake, saveHelperWords, onEnd],
  );

  return useMemo(() => ({ review, tapPart, element }), [review, tapPart, element]);
}
