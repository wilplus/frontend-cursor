"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MediaPlayer from "@/components/results/MediaPlayer";
import CoachVideo from "./CoachVideo";
import PracticeRecordingView from "./PracticeRecordingView";
import ConfidenceLabelChips from "@/components/willab/ConfidenceLabelChips";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  savePracticeHelperWords,
  type PracticeAnswer,
  type PracticePassage,
} from "@/services/api/confidentVoicePractice";
import {
  useConfidenceExercise,
  type PracticeOutcome,
} from "@/components/willab/useConfidenceExercise";
import type { Judgement, PractiseCard } from "@/lib/willab/paragraphOverlay";
import {
  canTap,
  nextSelection,
  phraseTokens,
  selectionLength,
  selectionText,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { opensRootPhrase } from "@/lib/willab/chunkSteps";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import { FeedbackPagerBar, type Pager } from "./feedbackPager";
import type { LockResult } from "./DeckChunkModal";

/* -------------------------------------------------------------------------- */
/*  THE PRACTISE SCREEN (founder lock 2026-09-30, B6, D1, D2, Q4, Q5).        */
/*                                                                            */
/*  Opened by Practise on the paragraph overlay, for any moment judged below  */
/*  In-between. Four screens, one after the other:                            */
/*                                                                            */
/*    SAY      the words to say as the main text — the exercise's passage     */
/*             under its video and instruction, the rewrite under "Say it     */
/*             this way", or the plain moment under "Say it again" — one      */
/*             record button, Skip in plain text. No judgement label (Q4).    */
/*    RECORD   the words stay on screen; Stop ends the attempt.               */
/*    JUDGE    the attempt's player, the passage in small print, the five     */
/*             answers. No, Not sure or Audio unclear: back to SAY for the    */
/*             next attempt, as long as she wants (D2); each attempt starts   */
/*             clean (Q5).                                                    */
/*    PICK     Yes or In-between: the picker over the attempt's own words,    */
/*             four at most (B3); "Use these helper words" saves them and     */
/*             locks the paragraph, and the walk continues.                   */
/*                                                                            */
/*  The paragraph is never rewritten by an attempt (B6, L1); only a Take does */
/*  that. Skip leaves the practice as it is, so Practise can be tapped again. */
/*  Words only (AC-9); every answer is the owner's own (L3).                  */
/* -------------------------------------------------------------------------- */

const EYEBROW =
  "text-[11px] uppercase tracking-[0.13em] text-muted-foreground";
const PILL =
  "flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] w-full items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

function SheetFrame({
  title,
  onClose,
  nav,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  nav: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="practise-sheet"
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2">
          {children}
        </div>
        <div className="shrink-0 px-5 pb-6 pt-2">{footer}</div>
      </div>
    </div>
  );
}

/** What the practise sends the server and heads the words with. Pure. */
export function passageOf(card: PractiseCard): {
  passage: PracticePassage;
  words: string;
  heading: string;
  video: string | null;
} {
  switch (card.kind) {
    case "exercise":
      return {
        passage: { kind: "exercise" },
        words: card.passage,
        heading: card.instruction ?? COPY.cardSayItAgain,
        video: card.video,
      };
    case "rewrite":
      return {
        passage: { kind: "rewrite", passage: card.text, feedbackId: card.item.id },
        words: card.text,
        heading: COPY.cardSayItThisWay,
        video: null,
      };
    case "praise":
      return {
        passage: { kind: "plain", feedbackId: card.item.id },
        words: card.text,
        heading: COPY.cardSayItAgain,
        video: null,
      };
    default:
      return {
        passage: { kind: "plain", feedbackId: card.item?.id ?? null },
        words: card.text,
        heading: COPY.cardSayItAgain,
        video: null,
      };
  }
}

/** The speaker's answer about the original, as given -- or none: a practice
 *  may start before any judgement (24e-1, 29a; F1 Repair Plan Phase 6), and
 *  a made-up "no" there was a judgement the speaker never gave. */
function practiceAnswerOf(judgement: Judgement | null): PracticeAnswer | null {
  return judgement;
}

function tokenTone(picked: boolean, reachable: boolean): string {
  if (picked) return "bg-primary/10 text-primary";
  return reachable ? "text-foreground" : "text-muted-foreground/60";
}

/** The picker over the attempt's own words (B6, "From your attempt"). */
function AttemptPicker({
  words,
  busy,
  failed,
  onUse,
}: {
  words: string;
  busy: boolean;
  failed: boolean;
  onUse: (phrase: string) => void;
}) {
  const tokens = useMemo(() => phraseTokens(words), [words]);
  const [run, setRun] = useState<PhraseSelection | null>(null);
  const chosen = selectionText(words, tokens, run);
  return (
    <>
      <div className="rounded-2xl border border-border px-3 py-4">
        <p className={EYEBROW}>
          {COPY.fromYourAttempt} · {COPY.emphasisCount(selectionLength(run))}
        </p>
        <div className="mt-2 flex flex-wrap gap-0.5" data-testid="picker-tokens">
          {tokens.map((token, index) => {
            const picked = run !== null && index >= run.from && index <= run.to;
            const reachable = canTap(run, index);
            return (
              <button
                key={`${token.start}-${token.text}`}
                type="button"
                aria-pressed={picked}
                disabled={!reachable}
                onClick={() => setRun(nextSelection(run, index))}
                className={`inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[15px] leading-tight transition-colors ${tokenTone(picked, reachable)}`}
              >
                {token.text}
              </button>
            );
          })}
        </div>
      </div>
      {failed ? (
        <p role="alert" className="rounded-xl border border-border p-3 text-[13px] text-destructive">
          {COPY.failRoot}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="practise-use-words"
        disabled={!chosen || busy}
        onClick={() => {
          if (chosen) onUse(chosen);
        }}
        className={PILL}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {COPY.pillEmphasise}
      </button>
    </>
  );
}

export default function PractiseSheet({
  item,
  judgement,
  card,
  partId,
  paragraphText,
  onLockIn,
  onSaved = null,
  onDone = null,
  pager = null,
  slideLabel = null,
  accepted = false,
  onClose,
}: {
  /** The Confident Voice item being practised: its clip, its evidence. */
  item: DocumentSuggestion;
  /** The rewrite was just accepted (29b): the heading says the words on
   *  screen are the paragraph's now. */
  accepted?: boolean;
  /** The speaker's answer on the moment, as given. */
  judgement: Judgement | null;
  /** The card shown on the overlay: what is practised. */
  card: PractiseCard;
  partId: string;
  /** The paragraph as it is now: what the lock commits, unchanged. */
  paragraphText: string;
  /** Lock the paragraph after the helper words are saved. */
  onLockIn: (text: string) => Promise<LockResult>;
  /** The helper words were saved: the host's "saved" line, before onDone. */
  onSaved?: (() => void) | null;
  /** The sheet finished — the words saved, or Skip — and the host moves on.
   *  Absent → the sheet closes. */
  onDone?: (() => void) | null;
  pager?: Pager | null;
  slideLabel?: string | null;
  onClose: () => void;
}) {
  const { passage, words, heading: cardHeading, video } = useMemo(
    () => passageOf(card), [card]);
  const heading = accepted && card.kind === "rewrite"
    ? COPY.cardSayItThisWayAccepted
    : cardHeading;
  const [phase, setPhase] = useState<"loop" | "pick">("loop");
  const [attemptWords, setAttemptWords] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [practiceJudgement, setPracticeJudgement] =
    useState<ConfidenceRatingValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const moveOn = onDone ?? onClose;

  // Yes or In-between on an attempt: the picker over its words (B6). Any
  // other answer with a finished practice is not reachable — the loop only
  // ends on those two — but a closed practice with no words still moves on
  // rather than dead-ending.
  const onFinished = useCallback(
    (answer: PracticeAnswer | null, outcome?: PracticeOutcome) => {
      if (answer && opensRootPhrase(answer) && outcome?.attemptWords) {
        setAttemptWords(outcome.attemptWords);
        setPracticeId(outcome.practiceId);
        setPhase("pick");
        return;
      }
      moveOn();
    },
    [moveOn],
  );
  const exercise = useConfidenceExercise({
    snippetId: item.snippetId ?? null,
    offer: item.practiceExercise ?? null,
    evidence: item.evidence ?? null,
    originalUserAnswer: practiceAnswerOf(judgement),
    passage,
    onFinished,
  });
  // Each attempt is judged afresh (Q5): the chips empty for every new
  // attempt on the judgement screen.
  const judgedId = exercise.corrected?.id ?? null;
  useEffect(() => {
    setPracticeJudgement(null);
  }, [exercise.screen, judgedId]);

  async function saveWords(phrase: string) {
    if (!practiceId || saving) return;
    setSaving(true);
    setSaveFailed(false);
    const saved = await savePracticeHelperWords(practiceId, partId, phrase);
    const locked = saved ? await onLockIn(paragraphText) : null;
    setSaving(false);
    if (!saved || !locked || locked.outcome !== "ok") {
      setSaveFailed(true);
      return;
    }
    onSaved?.();
    moveOn();
  }

  const nav = pager ? (
    <FeedbackPagerBar pager={{ ...pager, position: pager.label ?? slideLabel ?? undefined }} />
  ) : slideLabel ? (
    <p className="px-3 pt-1 text-center text-[13px] font-semibold text-foreground">
      {slideLabel}
    </p>
  ) : null;

  /* PICK — the helper words from the attempt (B6). */
  if (phase === "pick" && attemptWords) {
    return (
      <SheetFrame title={COPY.titleEmphasis} onClose={onClose} nav={nav} footer={null}>
        <AttemptPicker words={attemptWords} busy={saving} failed={saveFailed} onUse={(p) => void saveWords(p)} />
      </SheetFrame>
    );
  }

  /* JUDGE — the attempt alone, then the five answers. */
  if (exercise.screen === "judgement") {
    return (
      <SheetFrame
        title={COPY.titleFeedback}
        onClose={onClose}
        nav={nav}
        footer={
          <button type="button" className={LINK} onClick={() => exercise.back()} disabled={exercise.busy}>
            {COPY.linkBack}
          </button>
        }
      >
        <div data-practice-judgement className="flex flex-col gap-4">
          {exercise.corrected?.audioRef ? (
            <MediaPlayer
              src={exercise.corrected.audioRef}
              startOffsetMs={0}
              durationMs={exercise.corrected.durationMs}
              compact
              label={COPY.practiceAttemptLabel(exercise.corrected.attemptIndex)}
            />
          ) : null}
          <p data-testid="practise-passage" className="text-[13px] leading-relaxed text-muted-foreground">
            {words}
          </p>
          <ConfidenceLabelChips
            question={COPY.confidenceQuestion}
            value={practiceJudgement}
            disabled={exercise.busy}
            saving={exercise.busy}
            error={exercise.error}
            speakerWording
            onPick={(value) => {
              // Tap and go: the answer is the decision (Q17 A).
              setPracticeJudgement(value);
              void exercise.finish(value);
            }}
          />
        </div>
      </SheetFrame>
    );
  }

  /* RECORD — the words stay on screen; Stop ends the attempt. */
  if (exercise.recording) {
    return (
      <SheetFrame
        title={COPY.titlePractise}
        onClose={onClose}
        nav={nav}
        footer={
          <button type="button" data-testid="practise-stop" className={PILL} onClick={() => exercise.stop()}>
            <Square className="h-4 w-4" aria-hidden />
            {COPY.pillStop}
          </button>
        }
      >
        <PracticeRecordingView instruction={words} attempt={exercise.attemptNumber} />
      </SheetFrame>
    );
  }

  /* SAY — the words to say as the main text, one record button, Skip. */
  return (
    <SheetFrame
      title={COPY.titlePractise}
      onClose={onClose}
      nav={nav}
      footer={
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            data-testid="practise-record"
            className={PILL}
            disabled={exercise.busy}
            onClick={() => exercise.practise()}
          >
            {exercise.busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Mic className="h-4 w-4" aria-hidden />
            )}
            {COPY.pillPractise}
          </button>
          <button type="button" data-testid="practise-skip" className={LINK} onClick={moveOn}>
            {COPY.linkSkip}
          </button>
        </div>
      }
    >
      <div data-testid="practise-say" className="flex flex-col gap-4">
        {exercise.error ? (
          <p role="alert" data-testid="exercise-error" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[14px] font-medium text-destructive">
            {exercise.error}
          </p>
        ) : null}
        {video ? <CoachVideo src={video} /> : null}
        <p className={EYEBROW}>{heading}</p>
        <p className="text-[22px] font-semibold leading-snug text-foreground">{words}</p>
        <p className="text-[13px] text-muted-foreground">
          {COPY.practiceAttemptRecording(exercise.attemptNumber)}
        </p>
      </div>
    </SheetFrame>
  );
}
