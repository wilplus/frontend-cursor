"use client";

import { useEffect, useMemo, useState } from "react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  fetchOwnerAnswers,
  fetchParagraphHistory,
  type OwnerAnswer,
  type ParagraphHistory,
} from "@/services/api/bookmarkHistory";
import {
  answeredView,
  type LabelledLine,
} from "@/lib/willab/answeredBookmark";
import { isConfidentVoiceFeedback } from "@/lib/willab/chunkSteps";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  THE ANSWERED BOOKMARK (founder 2026-09-25, Q19 A).                         */
/*                                                                            */
/*  An unanswered bookmark opens the judgement sheet (DeckChunkModal), as it   */
/*  always has. An answered one opens HERE, on one screen: the exercise if the */
/*  moment has one, "You said" and the answer in one line, what happened to    */
/*  the moment in one or two boxes, then how the Slide's words and helper      */
/*  words changed. Copy signed off as written (Q21 A).                         */
/*                                                                            */
/*  Its own component so the judgement sheet — grandfathered at the           */
/*  complexity ratchet — gains no branch. Words only (AC-9); the answer is    */
/*  the owner's own self-report (L3). A read that fails leaves its section    */
/*  out rather than guessing it.                                              */
/* -------------------------------------------------------------------------- */

/** The exercise this moment carries, if any: the same exact-clip offer the
 *  judgement sheet would have shown. */
export function exerciseOf(
  items: readonly DocumentSuggestion[],
): DocumentSuggestion | null {
  return (
    items.find(
      (item) =>
        isConfidentVoiceFeedback(item) &&
        item.practiceExercise &&
        item.snippetId &&
        item.evidence,
    ) ?? null
  );
}

function Lines({
  heading,
  lines,
  accent = false,
}: {
  heading: string;
  lines: LabelledLine[];
  accent?: boolean;
}) {
  if (lines.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-foreground">{heading}</h3>
      <ol className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <li
            key={`${line.label ?? "line"}-${index}`}
            className="rounded-xl border border-border p-3"
          >
            {line.label ? (
              <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                {line.label}
              </p>
            ) : null}
            <p
              className={`whitespace-pre-line text-[15px] leading-relaxed ${
                accent ? "font-bold text-primary" : "text-foreground"
              }`}
            >
              {line.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function AnsweredBookmarkSheet({
  arcId,
  takeSessionId,
  partId,
  decided,
  onPractise,
  onClose,
}: {
  arcId: string | null;
  takeSessionId: string | null;
  partId: string;
  /** The answered items on this paragraph. */
  decided: readonly DocumentSuggestion[];
  /** Practise the moment's exercise again: the host reopens the judgement
   *  sheet on its exercise step. Absent → no Practise pill. */
  onPractise?: ((item: DocumentSuggestion, answer: string | null) => void) | null;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ParagraphHistory | null>(null);
  const [answers, setAnswers] = useState<OwnerAnswer[]>([]);

  useEffect(() => {
    let alive = true;
    if (arcId) {
      void fetchParagraphHistory(arcId, partId).then((result) => {
        if (alive) setHistory(result);
      });
    }
    if (takeSessionId) {
      void fetchOwnerAnswers(takeSessionId).then((result) => {
        if (alive) setAnswers(result);
      });
    }
    return () => {
      alive = false;
    };
  }, [arcId, takeSessionId, partId]);

  const view = useMemo(
    () => answeredView({ items: decided, answers, history, copy: COPY }),
    [decided, answers, history],
  );
  const exercise = exerciseOf(decided);
  const exerciseAnswer =
    answers.find((a) => a.feedbackId === exercise?.id)?.response ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.titleFeedback}
      data-testid="answered-bookmark"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="flex h-[97dvh] max-h-[97dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {COPY.titleFeedback}
          </h2>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-8 pt-2">
          {exercise?.practiceExercise ? (
            <section
              data-testid="answered-exercise"
              className="flex flex-col gap-3 rounded-2xl border border-border p-4"
            >
              <h3 className="text-[13px] font-semibold text-foreground">
                {COPY.titleExercise}
              </h3>
              {exercise.practiceExercise.explanationVideoRef ? (
                <div className="overflow-hidden rounded-2xl bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={exercise.practiceExercise.explanationVideoRef}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full"
                  />
                </div>
              ) : null}
              {(exercise.practiceExercise.instruction ?? "").trim() ? (
                <p className="text-[15px] leading-relaxed text-foreground">
                  {exercise.practiceExercise.instruction}
                </p>
              ) : null}
              {onPractise ? (
                <button
                  type="button"
                  onClick={() => onPractise(exercise, exerciseAnswer)}
                  className="flex min-h-[48px] items-center justify-center rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  {COPY.pillPractise}
                </button>
              ) : null}
            </section>
          ) : null}
          {view.youSaid ? (
            <p data-testid="answered-you-said" className="text-[15px] text-foreground">
              <span className="text-muted-foreground">{COPY.historyYouSaid}: </span>
              {view.youSaid}
            </p>
          ) : null}
          {view.boxes.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {view.boxes.map((box) => (
                <div key={box.label} className="rounded-xl border border-border p-3">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                    {box.label}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-foreground">
                    {box.text}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <Lines heading={COPY.historyHowItChanged} lines={view.versions} />
          <Lines heading={COPY.historyHelperWords} lines={view.helperWords} accent />
        </div>
      </div>
    </div>
  );
}
