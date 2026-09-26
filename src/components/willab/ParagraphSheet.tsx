"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Pencil } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import {
  fetchOwnerAnswers,
  fetchParagraphHistory,
  type OwnerAnswer,
  type ParagraphHistory,
} from "@/services/api/bookmarkHistory";
import {
  answeredView,
  timelineOf,
  type LabelledLine,
  type TimelineEntry,
} from "@/lib/willab/answeredBookmark";
import { isConfidentVoiceFeedback } from "@/lib/willab/chunkSteps";
import {
  nextSelection,
  phraseTokens,
  selectionSpan,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import { FeedbackPagerBar, type Pager } from "./feedbackPager";

/* -------------------------------------------------------------------------- */
/*  THE PARAGRAPH'S OWN SHEET (founder 2026-09-25, Q19 A, Q26 B, Q27 B).       */
/*                                                                            */
/*  Opens when a paragraph with nothing waiting is tapped and it was answered */
/*  or locked. An unanswered bookmark still opens the judgement sheet.        */
/*                                                                            */
/*    1. At the top: the Slide's helper words (tap them to choose new ones)   */
/*       and the paragraph as it is now.                                      */
/*    2. The exercise, if the moment has one, with Practise.                  */
/*    3. "You have judged this as your …", and what happened in one or two boxes.         */
/*    4. One timeline, newest Take first: what was said, and under it the     */
/*       helper words that were locked while it stood (Q26 B).                */
/*                                                                            */
/*  Tapping the helper words opens the word picker over the current           */
/*  paragraph (Q27 B): the current words shown above for reference, nothing   */
/*  selected, and "Use this phrase" locks the new ones at once (Q24 B).       */
/*                                                                            */
/*  Its own component so the judgement sheet — grandfathered at the           */
/*  complexity ratchet — gains no branch. Words only (AC-9); the answer is    */
/*  the owner's own self-report (L3). Every label is signed-off copy (Q21 A). */
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

const EYEBROW =
  "text-[11px] uppercase tracking-[0.13em] text-muted-foreground";

function SheetFrame({
  title,
  onClose,
  children,
  footer = null,
  nav = null,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** The walk's ‹ position › header, above the title (founder 2026-09-26). */
  nav?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="paragraph-sheet"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="flex h-[97dvh] max-h-[97dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {nav ? <div className="shrink-0 pt-3">{nav}</div> : null}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 pt-2">
          {children}
        </div>
        {footer ? <div className="shrink-0 px-5 pb-6 pt-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/** The top card: the Slide's helper words (a button) and the paragraph now. */
function NowCard({
  headline,
  text,
  onChooseWords,
}: {
  headline: string | null;
  text: string;
  onChooseWords: (() => void) | null;
}) {
  return (
    <div
      data-testid="paragraph-now"
      className="flex flex-col gap-3 rounded-2xl border border-pending/40 bg-pending/[0.08] p-4"
    >
      {headline ? (
        <button
          type="button"
          disabled={!onChooseWords}
          onClick={() => onChooseWords?.()}
          data-testid="paragraph-helper-words"
          className="flex flex-col items-start gap-1 text-left"
        >
          <span className={EYEBROW}>{COPY.historyHelperWords}</span>
          <span className="flex w-full items-start justify-between gap-3 text-[17px] font-bold leading-snug text-primary">
            {headline}
            {onChooseWords ? (
              <Pencil className="mt-1 h-4 w-4 shrink-0" aria-hidden />
            ) : null}
          </span>
        </button>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className={EYEBROW}>{COPY.historyNow}</span>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}

function ExerciseCard({
  item,
  onPractise,
}: {
  item: DocumentSuggestion;
  onPractise: (() => void) | null;
}) {
  const exercise = item.practiceExercise;
  if (!exercise) return null;
  return (
    <section
      data-testid="answered-exercise"
      className="flex flex-col gap-3 rounded-2xl border border-border p-4"
    >
      <h3 className="text-[13px] font-semibold text-foreground">
        {COPY.titleExercise}
      </h3>
      {exercise.explanationVideoRef ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={exercise.explanationVideoRef}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
          />
        </div>
      ) : null}
      {(exercise.instruction ?? "").trim() ? (
        <p className="text-[15px] leading-relaxed text-foreground">
          {exercise.instruction}
        </p>
      ) : null}
      {onPractise ? (
        <button
          type="button"
          onClick={onPractise}
          className="flex min-h-[48px] items-center justify-center rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          {COPY.pillPractise}
        </button>
      ) : null}
    </section>
  );
}

function Boxes({ boxes }: { boxes: LabelledLine[] }) {
  if (boxes.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {boxes.map((box) => (
        <div key={box.label} className="rounded-xl border border-border p-3">
          <p className={EYEBROW}>{box.label}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-foreground">
            {box.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" data-testid="paragraph-timeline">
      <h3 className="text-[13px] font-semibold text-foreground">
        {COPY.historyHowItChanged}
      </h3>
      <ol className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <li
            key={`${entry.label ?? "take"}-${index}`}
            className="flex flex-col gap-1 rounded-xl border border-border p-3"
          >
            {entry.label ? <p className={EYEBROW}>{entry.label}</p> : null}
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
              {entry.text}
            </p>
            {entry.helperWords ? (
              <p className="text-[14px] font-bold leading-snug text-primary">
                {entry.helperWords}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Q27 B: the current words above for reference, the paragraph below with
 *  nothing selected. "Use this phrase" waits for a tap, then locks. */
function HelperWordsPicker({
  headline,
  text,
  onUse,
  onClose,
}: {
  headline: string | null;
  text: string;
  onUse: (span: RootPhraseSpan) => Promise<boolean>;
  onClose: () => void;
}) {
  const tokens = useMemo(() => phraseTokens(text), [text]);
  const [run, setRun] = useState<PhraseSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const span = selectionSpan(text, tokens, run);

  async function use() {
    if (!span || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onUse(span);
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  }

  return (
    <SheetFrame
      title={COPY.titleEmphasis}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!span || busy}
          onClick={() => void use()}
          className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {COPY.pillEmphasise}
        </button>
      }
    >
      {headline ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
          <span className={EYEBROW}>
            {COPY.historyHelperWords} · {COPY.historyNow}
          </span>
          <span className="text-[16px] font-bold leading-snug text-primary">
            {headline}
          </span>
        </div>
      ) : null}
      <div className="rounded-2xl border border-border px-3 py-4">
        <p className={EYEBROW}>{COPY.cardTapWords}</p>
        <div className="mt-2 flex flex-wrap gap-0.5" data-testid="picker-tokens">
          {tokens.map((token, index) => {
            const picked = run !== null && index >= run.from && index <= run.to;
            return (
              <button
                key={`${token.start}-${token.text}`}
                type="button"
                aria-pressed={picked}
                onClick={() => setRun(nextSelection(run, index))}
                className={`inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[15px] leading-tight transition-colors ${
                  picked ? "bg-primary/10 text-primary" : "text-foreground"
                }`}
              >
                {token.text}
              </button>
            );
          })}
        </div>
      </div>
      {failed ? (
        <p className="rounded-xl border border-border p-3 text-[13px] text-destructive">
          {COPY.failRoot}
        </p>
      ) : null}
    </SheetFrame>
  );
}

/** Whose history to show under the coach's work (the coaching sheet). */
export interface HistoryTarget {
  arcId: string | null;
  partId: string;
  text: string;
  headline: string | null;
}

/** A done bookmark's history, for the coaching sheet (founder 2026-09-25):
 *  the helper words and the paragraph now, then one timeline by Take. */
export function ParagraphHistoryBlock({
  arcId,
  partId,
  text,
  headline,
}: HistoryTarget) {
  const [history, setHistory] = useState<ParagraphHistory | null>(null);
  useEffect(() => {
    let alive = true;
    if (arcId) {
      void fetchParagraphHistory(arcId, partId).then((result) => {
        if (alive) setHistory(result);
      });
    }
    return () => {
      alive = false;
    };
  }, [arcId, partId]);
  const entries = useMemo(() => timelineOf(history, COPY), [history]);
  return (
    <div className="flex flex-col gap-5" data-testid="bundle-history">
      <NowCard headline={headline} text={text} onChooseWords={null} />
      <Timeline entries={entries} />
    </div>
  );
}

export default function ParagraphSheet({
  arcId,
  takeSessionId,
  partId,
  text,
  headline,
  locked,
  decided,
  onPractise,
  onUseHelperWords,
  pager = null,
  onClose,
}: {
  arcId: string | null;
  takeSessionId: string | null;
  partId: string;
  /** The paragraph as it is now. */
  text: string;
  /** The Slide's locked helper words, joined " · " — or null. */
  headline: string | null;
  /** New helper words are chosen only on a locked paragraph (Q26). */
  locked: boolean;
  /** The answered items on this paragraph. */
  decided: readonly DocumentSuggestion[];
  /** Practise the moment's exercise again: the host reopens the judgement
   *  sheet on its exercise step. Absent → no Practise pill. */
  onPractise?: ((item: DocumentSuggestion, answer: string | null) => void) | null;
  /** Save the tapped words and lock them (Q24 B). Resolves true when both
   *  landed. Absent → the helper words are not a button. */
  onUseHelperWords?: ((span: RootPhraseSpan) => Promise<boolean>) | null;
  /** Back / Next across the Take's bookmarks (founder 2026-09-25). */
  pager?: Pager | null;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ParagraphHistory | null>(null);
  const [answers, setAnswers] = useState<OwnerAnswer[]>([]);
  const [picking, setPicking] = useState(false);

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
  const canChoose = locked && Boolean(onUseHelperWords);

  if (picking && onUseHelperWords) {
    return (
      <HelperWordsPicker
        headline={headline}
        text={text}
        onUse={onUseHelperWords}
        onClose={onClose}
      />
    );
  }

  return (
    <SheetFrame
      title={COPY.titleFeedback}
      onClose={onClose}
      nav={pager ? <FeedbackPagerBar pager={pager} /> : null}
    >
      <NowCard
        headline={headline}
        text={text}
        onChooseWords={canChoose ? () => setPicking(true) : null}
      />
      {exercise ? (
        <ExerciseCard
          item={exercise}
          onPractise={
            onPractise ? () => onPractise(exercise, exerciseAnswer) : null
          }
        />
      ) : null}
      {view.youSaid ? (
        <p data-testid="answered-you-said" className="text-[15px] text-foreground">
          {view.youSaid}
        </p>
      ) : null}
      <Boxes boxes={view.boxes} />
      <Timeline entries={view.timeline} />
    </SheetFrame>
  );
}
