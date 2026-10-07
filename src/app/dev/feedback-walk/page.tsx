"use client";

/* -------------------------------------------------------------------------- */
/*  Dev harness for the Feedback walk, phase 1 (e2e/feedback-walk.spec.mjs).    */
/*                                                                            */
/*  The founder-locked prototype's screens (FOUNDER-LOCK-feedback-walk-        */
/*  2026-10-06), drawn from the walk's primitives and fixtures, with the real */
/*  motion:                                                                   */
/*                                                                            */
/*    /dev/feedback-walk?screen=<name>   one screen, still                     */
/*    /dev/feedback-walk?flow=1          the whole walk; its own buttons move  */
/*                                       it, ‹ goes back, ✕ closes             */
/*                                                                            */
/*  Nothing here is mounted by the product, and nothing is fetched. Every     */
/*  word is a signed one (the copy files and the line bank of N54).           */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a test fixture, not a       */
/*  surface, and it must not become one.                                       */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { aiGeneratedLabel } from "@/lib/willab/aiGeneratedMark";
import type { WalkDir } from "@/lib/willab/walkMotion";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import { PRIMARY_RATING_OPTIONS, SECONDARY_RATING_OPTIONS } from "@/components/willab/ConfidenceLabelChips";
import WalkStage from "@/components/willab/walk/WalkStage";
import WalkToast from "@/components/willab/walk/WalkToast";
import WalkEndSheet from "@/components/willab/walk/WalkEndSheet";
import { WalkLink, WalkPill } from "@/components/willab/walk/WalkFooter";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import {
  FLOW,
  MOMENTS,
  PAGE_WORDS,
  PARAGRAPHS,
  PROJECT_TITLE,
  SCREEN_NAMES,
  SINGLE,
  SLIDE_LABEL,
  TAKE_SHOWN,
  makeToneUrl,
  type ScreenName,
  type Step,
} from "./walkFixtures";
import { LoungeStandIn, renderWalkScreen, type WalkCtx } from "./walkScreens";

type Mode = { kind: "index" } | { kind: "single"; name: ScreenName } | { kind: "flow" };

function readMode(search: string): Mode {
  const q = new URLSearchParams(search);
  if (q.get("flow") === "1") return { kind: "flow" };
  const name = q.get("screen");
  if (name && (SCREEN_NAMES as readonly string[]).includes(name)) return { kind: "single", name: name as ScreenName };
  return { kind: "index" };
}

const PROCESSING_MS = 2200;

/** The answer's own word, for the toast ("Yes ✓"; WQ4 A). */
const answerLabel = (value: ConfidenceRatingValue) =>
  [...PRIMARY_RATING_OPTIONS, ...SECONDARY_RATING_OPTIONS].find((o) => o.value === value)?.label ?? "";
const END_LEAVE_MS = 240;

/** The Ideal Text page under the overlay (a still stand-in). `cleared`:
 *  Skip on "Judgement time!" cleared the bars (Q-B6 A). */
function PageStandIn({
  answers,
  cleared = false,
  onReview,
}: {
  answers: Record<number, ConfidenceRatingValue>;
  cleared?: boolean;
  onReview: () => void;
}) {
  const bar = (i: number) => {
    if (cleared) return "bg-transparent";
    const a = answers[i];
    if (a === "yes" || a === "in_between") return "bg-affirm";
    if (a || MOMENTS[i]?.clearer || MOMENTS[i]?.exercise) return "bg-primary";
    return "bg-transparent";
  };
  return (
    <main data-testid="walk-page" className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex flex-col px-5 pb-2.5 pt-3">
        <b className="text-[17.5px] font-semibold">{PROJECT_TITLE}</b>
        <small className="text-[12px] text-muted-foreground">{aiGeneratedLabel("ideal-text", TAKE_SHOWN)}</small>
      </header>
      <div className="flex flex-1 flex-col gap-5 pb-2 pl-[34px] pr-[22px] pt-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{SLIDE_LABEL}</span>
        {PARAGRAPHS.map((p, i) => (
          <p key={i} className="relative m-0 text-[17px] leading-[1.65]">
            <span aria-hidden className={cn("absolute -left-[13px] bottom-0.5 top-0.5 w-[3px] rounded-full", bar(i))} />
            {p}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-1 px-5 pb-[30px] pt-2.5">
        <WalkPill action={{ label: PAGE_WORDS.reviewFeedback, onClick: onReview, testId: "walk-review" }} />
        <WalkLink action={{ label: PAGE_WORDS.recordTake(TAKE_SHOWN + 1), onClick: () => undefined }} />
      </div>
    </main>
  );
}

function IndexList() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 p-5 text-[15px]">
      <h1 className="text-[18px] font-bold">Feedback walk harness</h1>
      <a className="underline" href="?flow=1">flow</a>
      {SCREEN_NAMES.map((name) => (
        <a key={name} className="underline" href={`?screen=${name}`}>
          {name}
        </a>
      ))}
    </main>
  );
}

function useAudioSrc() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = makeToneUrl();
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, []);
  return src;
}

/** The practise screen's clock: counts up from 0 while it is open. */
function useClock(running: boolean, resetKey: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!running) return;
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running, resetKey]);
  return elapsed;
}

function Walk({ mode }: { mode: Exclude<Mode, { kind: "index" }> }) {
  const flow = mode.kind === "flow";
  const steps: readonly Step[] = useMemo(() => (flow ? FLOW : [SINGLE[mode.name]]), [flow, mode]);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<WalkDir | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<number, ConfidenceRatingValue>>({});
  const [helpers, setHelpers] = useState<Record<number, number[]>>({});
  const [community, setCommunity] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [endLeaving, setEndLeaving] = useState(false);
  // Skip on "Judgement time!" clears the bars (Q-B6 A); the walk still asks
  // to share, then the end card.
  const [barsCleared, setBarsCleared] = useState(false);
  // The Journal post, opened from "Judgement time!" and closed back to it.
  const [journalFrom, setJournalFrom] = useState<number | null>(null);
  const audioSrc = useAudioSrc();
  const step: Step = journalFrom === null ? steps[at] : { key: "journal" };
  const elapsed = useClock(step.key === "practise", `${at}`);

  const go = useCallback(
    (to: number, how?: WalkDir) => {
      if (!flow) return;
      setDir(how);
      setAt(Math.max(0, Math.min(steps.length - 1, to)));
    },
    [flow, steps.length],
  );
  const forward = useCallback(() => go(at + 1, "forward"), [go, at]);
  const back = useCallback(() => {
    if (journalFrom !== null) {
      setJournalFrom(null);
      setDir("back");
      return;
    }
    go(at - 1, "back");
  }, [go, at, journalFrom]);
  const close = useCallback(() => go(1), [go]);
  /** "Keep my words" (D-FW-12): the clearer version's practise is skipped.
   *  The walk goes on at the first later step that is not this moment's
   *  practise loop (practise, checking, praise or encouragement, helpers). */
  const keepWords = useCallback(() => {
    if (!flow) return;
    const moment = steps[at].moment;
    const loop = new Set(["practise", "processing", "improved", "encourage", "nothingMoved", "thirdTry", "helpers"]);
    let next = at + 1;
    while (next < steps.length - 1 && steps[next].moment === moment && loop.has(steps[next].key)) next += 1;
    go(next, "forward");
  }, [flow, steps, at, go]);
  /** Skip on "Judgement time!" (Q-B6 A): the bars are cleared, and the walk
   *  still asks to share, then the end card. */
  const skipJudging = useCallback(() => {
    if (!flow) return;
    setBarsCleared(true);
    setAnswers({});
    const community = steps.findIndex((s, i) => i > at && s.key === "community");
    go(community === -1 ? steps.length - 1 : community, "fade");
  }, [flow, steps, at, go]);
  const openJournal = useCallback(() => {
    if (!flow) return;
    setJournalFrom(at);
    setDir("forward");
  }, [flow, at]);

  // Checking a try: the machine's answer arrives on its own.
  useEffect(() => {
    if (!flow || step.key !== "processing") return;
    const timer = window.setTimeout(() => go(at + 1), PROCESSING_MS);
    return () => window.clearTimeout(timer);
  }, [flow, step.key, at, go]);

  const ctx = (s: Step): WalkCtx => ({
    step: s,
    // Back is off on the first judgement only, as in the prototype.
    first: s.key === "judge" && (s.moment ?? 0) === 0,
    audioSrc,
    forward,
    back,
    close,
    openJournal,
    keepWords,
    skipJudging,
    answers,
    answer: (moment, value) => {
      setAnswers((a) => ({ ...a, [moment]: value }));
      setToast(WALK_COPY.answerToast(answerLabel(value)));
      forward();
    },
    helpers,
    pickHelpers: (moment, picked) => setHelpers((h) => ({ ...h, [moment]: picked })),
    community,
    setCommunity,
    elapsed,
  });

  const leaveEnd = () => {
    if (!flow) return;
    setEndLeaving(true);
    window.setTimeout(() => {
      setEndLeaving(false);
      go(1);
    }, END_LEAVE_MS);
  };

  const pageIndex = steps.findIndex((s) => s.key === "page");
  return (
    <div data-walk-harness={mode.kind} data-walk-step={`${at}:${step.key}`}>
      {step.key === "lounge" ? (
        <LoungeStandIn walked={barsCleared || Object.keys(answers).length > 0} onOpen={() => go(pageIndex === -1 ? at + 1 : pageIndex, "forward")} />
      ) : (
        <PageStandIn answers={answers} cleared={barsCleared} onReview={() => go(pageIndex === -1 ? 1 : pageIndex + 1, "forward")} />
      )}
      <WalkStage screen={step} dir={dir} render={(s) => renderWalkScreen(ctx(s))} />
      {step.key === "end" ? (
        <WalkEndSheet
          leaving={endLeaving}
          pill={{ label: PAGE_WORDS.recordTake(TAKE_SHOWN + 1), onClick: () => undefined, testId: "walk-end-record" }}
          link={{ label: COPY.endCardBack, onClick: leaveEnd, testId: "walk-end-back" }}
        />
      ) : null}
      {toast ? <WalkToast key={`${at}`} message={toast} onDone={() => setToast(null)} /> : null}
    </div>
  );
}

function Harness() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => setMode(readMode(window.location.search)), []);
  if (!mode) return null;
  if (mode.kind === "index") return <IndexList />;
  return <Walk mode={mode} />;
}

export default function FeedbackWalkHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}
