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
/*    /dev/feedback-walk?live=1          the PRODUCTION walk (FeedbackWalk,    */
/*                                       D-FW-14) on these fixtures, opened on */
/*                                       its first screen; &guest=1 as a guest; */
/*                                       &practice=0 with personalised         */
/*                                       practice off (D-FW-15); &exvideo=0    */
/*                                       its exercise with no video (D-FW-17)  */
/*    /dev/feedback-walk?paragraph=this|saved|helpers                         */
/*                                       the PRODUCTION paragraph sheet and   */
/*                                       helper-words overlay in the walk's   */
/*                                       look (D-IT-6)                        */
/*                                                                            */
/*  Nothing here is mounted by the product, and nothing is fetched. Every     */
/*  word is a signed one (the copy files and the line bank of N54).           */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a test fixture, not a       */
/*  surface, and it must not become one.                                       */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WalkDir } from "@/lib/willab/walkMotion";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import { PRIMARY_RATING_OPTIONS, SECONDARY_RATING_OPTIONS } from "@/components/willab/ConfidenceLabelChips";
import WalkStage from "@/components/willab/walk/WalkStage";
import WalkToast from "@/components/willab/walk/WalkToast";
import WalkEndSheet from "@/components/willab/walk/WalkEndSheet";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import {
  FLOW,
  PAGE_WORDS,
  SCREEN_NAMES,
  SINGLE,
  TAKE_SHOWN,
  makeToneUrl,
  type ScreenName,
  type Step,
} from "./walkFixtures";
import PageStandIn from "./pageStandIn";
import LiveWalk from "./liveWalk";
import ParagraphWalk, { type ParagraphView } from "./paragraphWalk";
import { LoungeStandIn, renderWalkScreen, type WalkCtx } from "./walkScreens";
import type { PhraseSelection } from "@/lib/willab/phraseTokens";

type Mode =
  | { kind: "index" }
  | { kind: "single"; name: ScreenName }
  | { kind: "flow" }
  | { kind: "live"; guest: boolean; practiceOn: boolean; exerciseVideo: boolean }
  | { kind: "paragraph"; view: ParagraphView };

const PARAGRAPH_VIEWS: readonly ParagraphView[] = ["this", "saved", "helpers"];

function readMode(search: string): Mode {
  const q = new URLSearchParams(search);
  if (q.get("live") === "1") {
    return {
      kind: "live",
      guest: q.get("guest") === "1",
      practiceOn: q.get("practice") !== "0",
      exerciseVideo: q.get("exvideo") !== "0",
    };
  }
  if (q.get("flow") === "1") return { kind: "flow" };
  const view = q.get("paragraph");
  if (view && (PARAGRAPH_VIEWS as readonly string[]).includes(view)) {
    return { kind: "paragraph", view: view as ParagraphView };
  }
  const name = q.get("screen");
  if (name && (SCREEN_NAMES as readonly string[]).includes(name)) return { kind: "single", name: name as ScreenName };
  return { kind: "index" };
}

const PROCESSING_MS = 2200;

/** The answer's own word, for the toast ("Yes ✓"; WQ4 A). */
const answerLabel = (value: ConfidenceRatingValue) =>
  [...PRIMARY_RATING_OPTIONS, ...SECONDARY_RATING_OPTIONS].find((o) => o.value === value)?.label ?? "";
const END_LEAVE_MS = 240;

function IndexList() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 p-5 text-[15px]">
      <h1 className="text-[18px] font-bold">Feedback walk harness</h1>
      <a className="underline" href="?flow=1">flow</a>
      <a className="underline" href="?live=1">live</a>
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

function Walk({ mode }: { mode: Extract<Mode, { kind: "single" | "flow" }> }) {
  const flow = mode.kind === "flow";
  const steps: readonly Step[] = useMemo(() => (flow ? FLOW : [SINGLE[mode.name]]), [flow, mode]);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<WalkDir | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<number, ConfidenceRatingValue>>({});
  const [helpers, setHelpers] = useState<Record<number, PhraseSelection | null>>({});
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
  if (mode.kind === "live") {
    return <LiveWalk guest={mode.guest} practiceOn={mode.practiceOn} exerciseVideo={mode.exerciseVideo} />;
  }
  if (mode.kind === "paragraph") return <ParagraphWalk view={mode.view} />;
  return <Walk mode={mode} />;
}

export default function FeedbackWalkHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}
