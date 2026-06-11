"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchLastSetup } from "./willabLastSetup";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording } from "@/services/api/labRecording";
import { domainSpec } from "./domains";
import { readWillabProfile } from "./willabProfile";
import { fmtClock, liveWpm, parseVocabulary } from "./willabHelpers";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { useSignedIn } from "./useSignedIn";
import { readoutSummaryDraft } from "./loungeReports";
import { clearParked, readParked, writeParked } from "./willabParked";
import { setPendingSend, setReviewPending } from "./sendStatus";
import type { ReadoutPayload } from "./readout";
import ReadoutCard from "./ReadoutCard";
import SendGate from "./SendGate";
import FeelingsCheckIn from "./FeelingsCheckIn";
import { markFirstRecordingOnboarded, type WillabState } from "./useWillabFlow";
import { useBackDismiss } from "./useBackDismiss";
import PresentationInput from "./PresentationInput";
import SlideStage from "./SlideStage";
import {
  initialSlides,
  nonEmptySlides,
  type PresentationSlide,
} from "./presentation";

/* -------------------------------------------------------------------------- */
/*  LabOverlay — the official-recording training zone (§4)                     */
/*                                                                            */
/*  Overlay over the always-mounted Lounge (NOT a route — closing returns to   */
/*  the Lounge with no remount). Distinct "training zone" chrome; holds the    */
/*  mic for its lifetime via useDualCaptureMic and releases it on close.       */
/*                                                                            */
/*    lab_session_context → §4 step A form (topic required; rest pre-filled)   */
/*    lab_prerecord       → task + high-stakes framing + one large record ctrl */
/*    lab_recording       → live capture, timer, min-content gate (≥60s)       */
/*    lab_processing      → SYNCHRONOUS upload (submitLabRecording, §3.3) →     */
/*                          Readout on 201 · re-record on 422 · error+retry     */
/*    readout             → §5 ReadoutCard (live payload); send gate = §13      */
/* -------------------------------------------------------------------------- */

/** Per-recording context (§4 step A). Shape matches the BE intake-context
 *  fields; HOW it's persisted (with-upload vs draft id) is BE confirm ②. */
export interface LabSessionContext {
  topic: string;
  audience: string;
  target_length_seconds: number | null;
  domain_vocabulary: string[];
  /** Slide-deck context (§S) — the user's deck; optional. */
  slides: PresentationSlide[];
  /** The BE-served PDF url when a deck was uploaded; null for manual / none. */
  presentationRef: string | null;
}

/** §4 min-content gate (client pre-check; BE ③ is authoritative for has-speech). */
const MIN_RECORDING_SEC = 60;

const LENGTH_PRESETS = [
  { label: "1 min", sec: 60 },
  { label: "2 min", sec: 120 },
  { label: "3 min", sec: 180 },
  { label: "5 min", sec: 300 },
];

export default function LabOverlay({
  state,
  sessionId,
  goTo,
  onClose,
}: {
  state: WillabState;
  sessionId: string | null;
  goTo: (s: WillabState) => void;
  onClose: () => void;
}) {
  // D-3 — back-gesture / Back exits the Lab instead of routing away.
  useBackDismiss(onClose);
  const router = useRouter();
  const mic = useDualCaptureMic();
  const { cancel: cancelMic } = mic;
  const signedIn = useSignedIn();
  const [context, setContext] = useState<LabSessionContext | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // In-Lab presenter (T8): which slide is up + the tap timeline captured during
  // recording. Each entry is a real timestamp of a user tap (mechanical, never
  // voice-driven); the BE maps snippet → slide from it (greatest t_ms ≤ start).
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideAdvancesRef = useRef<{ index: number; tMs: number }[]>([]);
  const recordStartRef = useRef(0);
  const { append: appendToThread } = useLoungeThreadCtx();
  const reportedRef = useRef(false);

  // Upload → Readout (seam ③).
  const [readout, setReadout] = useState<ReadoutPayload | null>(null);
  const [labSessionId, setLabSessionId] = useState<string | null>(null);
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const durationRef = useRef(0);
  const uploadStartedRef = useRef(false);

  const profile = useRef(readWillabProfile()).current;
  const seededVocab = profile ? domainSpec(profile.domain).vocabulary : [];
  // "Same as last time" — the last set-up, sourced from the BE (cross-device,
  // survives a cache clear); null → no prior session → the button hides.
  // applyLastNonce bumps to trigger the form to re-fill.
  const [lastSetup, setLastSetup] = useState<LabSessionContext | null>(null);
  const [applyLastNonce, setApplyLastNonce] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchLastSetup().then((s) => active && setLastSetup(s));
    return () => {
      active = false;
    };
  }, []);

  // Drive flow transitions off the mic state machine.
  useEffect(() => {
    const s = mic.state;
    if (s.status === "recording" && state === "lab_prerecord") {
      reportedRef.current = false; // fresh recording → allow a new history entry
      // T8 — start the slide timeline: slide 0 is on screen at t=0.
      recordStartRef.current = performance.now();
      setCurrentSlide(0);
      slideAdvancesRef.current = [{ index: 0, tMs: 0 }];
      goTo("lab_recording");
    }
    if (
      s.status === "stopped" &&
      state === "lab_recording" &&
      s.durationSec >= MIN_RECORDING_SEC
    ) {
      durationRef.current = s.durationSec;
      setBlob(s.audioBlob);
      goTo("lab_processing");
    }
  }, [mic.state, state, goTo]);

  // seam ③ — fire the synchronous upload once on entering processing.
  useEffect(() => {
    if (state !== "lab_processing") {
      uploadStartedRef.current = false;
      return;
    }
    if (!blob || !context || uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    let active = true;
    void (async () => {
      const result = await submitLabRecording({
        audioBlob: blob,
        durationSec: durationRef.current,
        topic: context.topic,
        audience: context.audience || undefined,
        targetLengthSeconds: context.target_length_seconds,
        domainVocabulary: context.domain_vocabulary,
        slides: context.slides,
        presentationRef: context.presentationRef,
        slideAdvances: slideAdvancesRef.current,
      });
      if (!active) return;
      if (result.kind === "ok") {
        setReadout(result.readout);
        setLabSessionId(result.sessionId);
        setUploadError(null);
        goTo("readout");
      } else if (result.kind === "rejected") {
        cancelMic();
        setRejectedMsg(result.message);
        goTo("lab_prerecord");
      } else {
        setUploadError(result.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [state, blob, context, goTo, cancelMic, retryNonce]);

  // Recording timer (250ms tick; reset whenever not recording).
  useEffect(() => {
    if (mic.state.status !== "recording") {
      setElapsed(0);
      return;
    }
    const startedAt = performance.now();
    const id = setInterval(
      () => setElapsed((performance.now() - startedAt) / 1000),
      250
    );
    return () => clearInterval(id);
  }, [mic.state.status]);

  // Resume a parked Readout: restore the held payload on (re)entry to the
  // Readout with nothing loaded (e.g. after reload, via the Lounge's "Resume
  // Readout"). reportedRef is set so the history entry isn't re-added.
  useEffect(() => {
    if (state === "readout" && readout === null) {
      const parked = readParked();
      if (parked) {
        setReadout(parked.readout);
        setLabSessionId(parked.sessionId);
        setContext({
          topic: parked.topic,
          audience: "",
          target_length_seconds: null,
          domain_vocabulary: [],
          slides: [],
          presentationRef: null,
        });
        reportedRef.current = true;
      }
    }
  }, [state, readout]);

  // Persist a Readout report into the Lounge history once the recording
  // completes, so the user can scroll back to it (topic now; the §3.3 hero
  // metrics fill in when seam ③ returns real data).
  useEffect(() => {
    if (state === "readout" && context && !reportedRef.current) {
      reportedRef.current = true;
      const hero = readout?.snippets[0]?.features;
      void appendToThread(
        readoutSummaryDraft({
          topic: context.topic,
          recordingId: labSessionId ?? undefined,
          speechRate: hero?.speechRate ?? undefined,
          pauseRatio: hero?.pauseRatio ?? undefined,
        })
      );
    }
  }, [state, context, appendToThread, readout, labSessionId]);

  // Park the held Readout (persist + route to the Lounge's parked chip).
  function parkReadout() {
    if (readout) {
      writeParked({ sessionId: labSessionId, topic: context?.topic ?? "", readout });
    }
    goTo("parked");
  }

  // Unsigned send (§13 Path 2, amended): park + stash the id, then navigate
  // to the /signup picker so the user can choose LinkedIn OR email/password
  // — the original spec went straight to LinkedIn OAuth ("one tap to ship"),
  // but that dead-ends users who don't have LinkedIn or who prefer email.
  // The picker costs one extra tap for LinkedIn users; gains a real path for
  // everyone else. The resume mechanism is unchanged: the global
  // <WillabPendingSend> reads the pending id on any post-auth landing
  // (SIGNED_IN event from either provider) and runs merge-then-send.
  function startUnsignedSend() {
    if (readout && labSessionId) {
      writeParked({ sessionId: labSessionId, topic: context?.topic ?? "", readout });
      setPendingSend(labSessionId);
    }
    router.push("/signup");
  }

  // T8 — advance the deck during recording, logging the tap timeline. Any change
  // (forward or back) is a real "what's on screen now" event with its timestamp.
  function advanceSlide(dir: 1 | -1) {
    const total = context?.slides.length ?? 0;
    if (total === 0) return;
    setCurrentSlide((c) => {
      const next = Math.min(Math.max(c + dir, 0), total - 1);
      if (next !== c) {
        slideAdvancesRef.current.push({
          index: next,
          tMs: Math.round(performance.now() - recordStartRef.current),
        });
      }
      return next;
    });
  }

  function handleClose() {
    if (mic.state.status === "recording") {
      if (!window.confirm("Discard this recording? It hasn't been sent.")) return;
      mic.cancel();
      onClose();
      return;
    }
    // Post-recording: closing parks (hold, don't discard) per §4.
    if (state === "readout") {
      parkReadout();
      return;
    }
    mic.cancel();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      {/* §4 training-zone chrome. The set-up step is a clean X-only header
          (design spec); the recording/readout steps keep the status line. */}
      {state === "lab_session_context" ? (
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          {/* Top-left: re-fill the whole set-up from last time (only when there
              is a saved set-up). Right: close. */}
          {lastSetup ? (
            <button
              type="button"
              onClick={() => setApplyLastNonce((n) => n + 1)}
              className="inline-flex h-9 items-center rounded-full px-3 text-[14px] text-foreground/70 transition hover:bg-muted"
            >
              Same as last time
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
      ) : (
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-semibold text-foreground">
            Official recording · not yet sent
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close the Lab"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {state === "lab_feelings" && (
          <FeelingsCheckIn
            onReady={() => {
              markFirstRecordingOnboarded();
              goTo("lab_session_context");
            }}
          />
        )}

        {state === "lab_session_context" && (
          <SessionContextForm
            seededVocab={seededVocab}
            lastSetup={lastSetup}
            applyNonce={applyLastNonce}
            onSubmit={(ctx) => {
              setContext(ctx);
              goTo("lab_prerecord");
            }}
          />
        )}

        {state === "lab_prerecord" && (
          <PreRecord
            context={context}
            rejectedMsg={rejectedMsg}
            onRecord={() => {
              setRejectedMsg(null);
              void mic.start();
            }}
            micState={mic.state}
          />
        )}

        {state === "lab_recording" && (
          <RecordingPhase
            micState={mic.state}
            elapsed={elapsed}
            onStop={() => void mic.stop()}
            onRecordAgain={() => void mic.start()}
            slides={context?.slides ?? []}
            presentationRef={context?.presentationRef ?? null}
            currentSlide={currentSlide}
            onAdvance={advanceSlide}
          />
        )}

        {state === "lab_processing" && (
          <Processing
            error={uploadError}
            onRetry={() => {
              setUploadError(null);
              uploadStartedRef.current = false;
              setRetryNonce((n) => n + 1);
            }}
            onClose={onClose}
          />
        )}

        {state === "readout" && (
          <ReadoutCard
            payload={
              readout ?? {
                snippets: [],
                overallMessage: null,
                videoRef: null,
                presentationRef: null,
              }
            }
            onSend={() => goTo(sessionId ? "sendgate_signed" : "sendgate_unsigned")}
            onExplain={parkReadout}
          />
        )}

        {(state === "sendgate_unsigned" || state === "sendgate_signed") && (
          <SendGate
            sessionId={labSessionId}
            signedIn={signedIn}
            onSent={() => {
              clearParked();
              setReviewPending(labSessionId);
              goTo("review_pending");
            }}
            onPark={parkReadout}
            onSignIn={startUnsignedSend}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------- §4 step A: context --------------------------- */

/** Setup-page input — one shared style (design spec). */
const SETUP_INPUT_CLS =
  "w-full h-12 rounded-xl border border-border bg-background px-4 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition";

/** A labelled setup section. One label style throughout; no badges / hints. */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-4">
      <label
        htmlFor={htmlFor}
        className="mb-3 block text-[15px] font-semibold text-foreground"
      >
        {label}
      </label>
      {children}
    </section>
  );
}

function SessionContextForm({
  seededVocab,
  lastSetup,
  applyNonce,
  onSubmit,
}: {
  seededVocab: string[];
  lastSetup: LabSessionContext | null;
  applyNonce: number;
  onSubmit: (ctx: LabSessionContext) => void;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  const [vocab, setVocab] = useState(seededVocab.join(", "));
  const [slides, setSlides] = useState<PresentationSlide[]>(initialSlides());
  const [presentationRef, setPresentationRef] = useState<string | null>(null);

  // "Same as last time" — when the header bumps applyNonce, re-fill every field
  // from the last submitted set-up.
  useEffect(() => {
    if (applyNonce <= 0 || !lastSetup) return;
    setTopic(lastSetup.topic);
    setAudience(lastSetup.audience);
    setLengthSec(lastSetup.target_length_seconds);
    setVocab(lastSetup.domain_vocabulary.join(", "));
    setSlides(lastSetup.slides.length > 0 ? lastSetup.slides : initialSlides());
    setPresentationRef(lastSetup.presentationRef);
  }, [applyNonce, lastSetup]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    onSubmit({
      topic: t,
      audience: audience.trim(),
      target_length_seconds: lengthSec,
      domain_vocabulary: parseVocabulary(vocab),
      slides: nonEmptySlides(slides),
      presentationRef,
    });
  }

  return (
    <form onSubmit={submit}>
      {/* pb clears the fixed CTA */}
      <div className="pb-24">
        <Field label="What are you speaking on?" htmlFor="topic">
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. my Q3 results pitch"
            className={SETUP_INPUT_CLS}
            autoFocus
          />
        </Field>

        <Field label="Audience" htmlFor="aud">
          <input
            id="aud"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. the leadership team"
            className={SETUP_INPUT_CLS}
          />
        </Field>

        <Field label="Target length">
          <div className="flex flex-wrap gap-2">
            {LENGTH_PRESETS.map((p) => {
              const active = lengthSec === p.sec;
              return (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => setLengthSec(active ? null : p.sec)}
                  aria-pressed={active}
                  className={cn(
                    "h-10 rounded-full border px-4 text-[14px] transition active:scale-[0.98]",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Key words" htmlFor="words">
          <input
            id="words"
            value={vocab}
            onChange={(e) => setVocab(e.target.value)}
            placeholder="Words that help transcription accuracy"
            className={SETUP_INPUT_CLS}
          />
        </Field>

        <Field label="Your slides">
          <PresentationInput
            slides={slides}
            presentationRef={presentationRef}
            onChange={(s, ref) => {
              setSlides(s);
              setPresentationRef(ref);
            }}
          />
        </Field>
      </div>

      {/* Sticky CTA (design spec) — disabled until there's a topic. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <button
            type="submit"
            disabled={!topic.trim()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[14px] font-medium text-background transition hover:bg-foreground/90 active:scale-[0.99] disabled:opacity-40"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Start recording
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------- §4 step B: pre-record -------------------------- */

function PreRecord({
  context,
  rejectedMsg,
  onRecord,
  micState,
}: {
  context: LabSessionContext | null;
  rejectedMsg: string | null;
  onRecord: () => void;
  micState: ReturnType<typeof useDualCaptureMic>["state"];
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
          Speak on
        </p>
        <p className="mt-1 text-[22px] font-semibold text-foreground">
          {context?.topic ?? "your topic"}
        </p>
        {context?.audience ? (
          <p className="mt-1 text-[15px] text-muted-foreground">
            for {context.audience}
          </p>
        ) : null}
      </div>

      <p className="max-w-sm text-[15px] text-muted-foreground">
        This is your official take — speak as if it counts. Aim for at least one
        minute.
      </p>

      {rejectedMsg ? (
        <p className="max-w-sm text-[13px] text-destructive">{rejectedMsg}</p>
      ) : null}

      <button
        type="button"
        onClick={onRecord}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Start recording"
      >
        <Mic className="h-8 w-8" />
      </button>

      {micState.status === "error" ? (
        <p className="text-[13px] text-destructive">{micState.message}</p>
      ) : null}
    </div>
  );
}

/* ------------------------- §4 step B: recording -------------------------- */

function RecordingPhase({
  micState,
  elapsed,
  onStop,
  onRecordAgain,
  slides,
  presentationRef,
  currentSlide,
  onAdvance,
}: {
  micState: ReturnType<typeof useDualCaptureMic>["state"];
  elapsed: number;
  onStop: () => void;
  onRecordAgain: () => void;
  slides: PresentationSlide[];
  presentationRef: string | null;
  currentSlide: number;
  onAdvance: (dir: 1 | -1) => void;
}) {
  // Too-short re-record prompt (min-content gate).
  if (micState.status === "stopped" && micState.durationSec < MIN_RECORDING_SEC) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-[17px] font-semibold text-foreground">
          That was only {fmtClock(micState.durationSec)}
        </p>
        <p className="max-w-sm text-[15px] text-muted-foreground">
          We need at least {fmtClock(MIN_RECORDING_SEC)} of speech for a useful
          read. Nothing was sent — give it another go.
        </p>
        <Button onClick={onRecordAgain} className="rounded-full px-6">
          Record again
        </Button>
      </div>
    );
  }

  if (micState.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] text-destructive">
          {micState.message}
        </p>
        <Button onClick={onRecordAgain} variant="outline" className="rounded-full px-6">
          Try again
        </Button>
      </div>
    );
  }

  const reachedMin = elapsed >= MIN_RECORDING_SEC;
  const remaining = Math.max(0, Math.ceil(MIN_RECORDING_SEC - elapsed));
  // U8 — live wpm from the interim transcript (null when Web Speech yields none).
  const partialText =
    micState.status === "recording" ? micState.partialText : "";
  const wpm = liveWpm(partialText, elapsed);
  const hasDeck = slides.length > 0;
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-6 text-center ${
        hasDeck ? "justify-start pt-1" : "justify-center"
      }`}
    >
      {/* T9 — the deck during recording: the user taps to advance while they
          speak (manual). Only shown when a deck was attached. */}
      {hasDeck ? (
        <SlideStage
          slides={slides}
          presentationRef={presentationRef}
          current={currentSlide}
          onNext={() => onAdvance(1)}
          onPrev={() => onAdvance(-1)}
        />
      ) : null}

      <div className="flex items-center gap-2 text-destructive">
        <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
        <span className="text-[13px] font-medium">Recording</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-[40px] font-semibold tabular-nums text-foreground">
          {fmtClock(elapsed)}
        </p>
        {/* U8 — live words-per-minute from the interim transcript; hidden when
            Web Speech yields no transcript (unavailable) rather than showing 0. */}
        {wpm != null ? (
          <p className="text-[12px] tabular-nums text-muted-foreground">
            ≈ {wpm} wpm
          </p>
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {reachedMin
          ? "Minimum reached. Stop whenever you're ready."
          : `Keep going, ${fmtClock(remaining)} until you can stop.`}
      </p>

      {/* U11 — the stop control is LOCKED until the minimum is reached, so a
          recording can't be ended too short (FE enforcement of the §3.3/§5.5
          min-content gate). Remaining time is surfaced above; the button is
          disabled + visually muted until then. */}
      <button
        type="button"
        onClick={onStop}
        disabled={!reachedMin}
        aria-label={
          reachedMin
            ? "Stop recording"
            : `Keep recording, ${fmtClock(remaining)} until you can stop`
        }
        className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-transform ${
          reachedMin
            ? "border-destructive text-destructive hover:scale-105"
            : "cursor-not-allowed border-muted-foreground/25 text-muted-foreground/40"
        }`}
      >
        <Square className="h-7 w-7 fill-current" />
      </button>
    </div>
  );
}

/* ----------------------- BE seam ③ + tail stubs -------------------------- */

function Processing({
  error,
  onRetry,
  onClose,
}: {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] text-destructive">{error}</p>
        <p className="max-w-sm text-[12px] text-muted-foreground">
          Your recording isn&apos;t lost — try the analysis again, or step back
          to the Lounge and resume later.
        </p>
        <div className="flex gap-2">
          <Button onClick={onRetry} className="rounded-full px-6">
            Try again
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-full px-6"
          >
            Back to Lounge
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-[15px] text-foreground">Analyzing your recording…</p>
      <p className="max-w-sm text-[12px] text-muted-foreground">
        Transcribing and measuring your voice — this takes a few seconds.
      </p>
    </div>
  );
}

