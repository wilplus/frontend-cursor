"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchLastSetup } from "./willabLastSetup";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording } from "@/services/api/labRecording";
import { readVideoDurationSec } from "@/services/api/coachVideoMeta";
import { takeLabUpload } from "./labUploadStage";
import { domainSpec } from "./domains";
import { readWillabProfile } from "./willabProfile";
import { batchTake, fmtClock } from "./willabHelpers";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { useSignedIn } from "./useSignedIn";
import { readoutSummaryDraft } from "./loungeReports";
import { clearParked, readParked, writeParked } from "./willabParked";
import { setPendingSend, setReviewPending } from "./sendStatus";
import type { ReadoutPayload } from "./readout";
import ReadoutCard from "./ReadoutCard";
import SendGate from "./SendGate";
import FeelingsCheckIn from "./FeelingsCheckIn";
import { clearFeeling, getLastFeeling, type Feeling } from "./willabFeelings";
import { type WillabState } from "./useWillabFlow";
import { useBackDismiss } from "./useBackDismiss";
import PresentationInput from "./PresentationInput";
import SlideStage from "./SlideStage";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
  type ExploreArcDeck,
} from "@/lib/willab/exploreArc";
import {
  clampSlides,
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
  onRecordingProgress,
}: {
  state: WillabState;
  sessionId: string | null;
  goTo: (s: WillabState) => void;
  onClose: () => void;
  onRecordingProgress?: (p: import("@/services/api/recordingProgress").RecordingProgress | null) => void;
}) {
  // D-3 — back-gesture / Back exits the Lab instead of routing away. During the
  // readout phase, Back first steps the readout's own layout (collapse a moment,
  // page back) before it exits the Lab.
  const readoutBackRef = useRef<(() => boolean) | null>(null);
  useBackDismiss(onClose, () =>
    state === "readout" ? readoutBackRef.current?.() ?? false : false
  );
  const router = useRouter();
  // T8 — the Lab transcribes server-side (Whisper) and never shows a live
  // transcript, so skip Web Speech: its per-result events would re-render the
  // whole recording overlay many times a second (worse the longer the take),
  // which is what made the screen go stale / the slide Next feel unresponsive.
  const mic = useDualCaptureMic({ transcript: false });
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

  // Explore-arc state (Prompt B §F2). Read from localStorage on mount so the
  // arc_id carries across LabOverlay sessions (Lounge → Lab → Lounge → Lab…).
  // initArc is stable for the overlay's lifetime; state mirrors it for renders.
  const initArc = useRef(readExploreArc()).current;
  const [arcId, setArcId] = useState<string | null>(initArc?.arcId ?? null);
  const [arcTakeIndex, setArcTakeIndex] = useState<number>(
    initArc?.nextTakeIndex ?? 1
  );
  const [exploreEnabled, setExploreEnabled] = useState<boolean>(!!initArc);

  // Upload → Readout (seam ③).
  const [readout, setReadout] = useState<ReadoutPayload | null>(null);
  const [labSessionId, setLabSessionId] = useState<string | null>(null);
  // The take number for THIS recording, captured at upload time — before the
  // success handler bumps arcTakeIndex to the next take (avoids an off-by-one
  // on the "Your Recording" card).
  const recordedTakeRef = useRef<number | null>(null);
  // C7 — the feeling named for THIS take, captured at upload then cleared so a
  // later take's joke offer can't read a stale value; stamped on the readout.
  const recordedFeelingRef = useRef<Feeling | null>(null);
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // True when the upload failure was a 402 — Processing then shows a neutral
  // paywall panel (unlock link, no retry) instead of the destructive error.
  const [uploadPaywall, setUploadPaywall] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const durationRef = useRef(0);
  const uploadStartedRef = useRef(false);
  // Guards for the deckless file-upload path. uploadSeqRef is bumped on every
  // upload pick AND on mic start, so a slow duration read (up to 4s) that
  // resolves after the user changed their mind (tapped record, or picked a
  // different file) is stale and bails — it can't yank the flow into processing
  // mid-recording. mountedRef bails if the overlay closed during that window.
  const uploadSeqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);
  // A file the user picked from the Lounge footer ("Upload a recording"),
  // consumed once on mount. When present, the context form collects the topic
  // then submits this file straight through (deckless) instead of live-record.
  const stagedUploadRef = useRef<File | null>(takeLabUpload());

  const profile = useRef(readWillabProfile()).current;
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
    recordedTakeRef.current = exploreEnabled ? arcTakeIndex : null;
    // C7 — capture the named feeling for this take, then clear the active value
    // (the remembered value persists for the next take's "same as before"). Only
    // overwrite when a fresh value is present so a retry / re-record re-running
    // this effect (the active key is already cleared) can't null out the capture.
    const capturedFeeling = getLastFeeling();
    if (capturedFeeling) {
      recordedFeelingRef.current = capturedFeeling;
      clearFeeling();
    }
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
        // Explore-arc fields — omitted for standalone recordings.
        exploreSession: exploreEnabled && arcId === null ? true : undefined,
        arcId: arcId ?? undefined,
        takeIndex: exploreEnabled ? arcTakeIndex : undefined,
        feeling: recordedFeelingRef.current ?? undefined,
      });
      if (!active) return;
      if (result.kind === "ok") {
        // Carry the arc: write the returned arc_id + next take_index to
        // localStorage so the next LabOverlay session picks it up.
        if (exploreEnabled) {
          const returnedArcId = result.arcId ?? arcId;
          if (returnedArcId) {
            // 3-take batch cycle (founder 2026-07-11): the BE stops joining an
            // arc at 3 takes and returns a FRESH arc (take_index resets). Trust
            // the BE's take_index when present so the local counter follows the
            // batch; fall back to the local increment for older payloads. Carry
            // the deck forward so the next take pre-fills the Lab.
            const nextIdx =
              (typeof result.takeIndex === "number" && result.takeIndex > 0
                ? result.takeIndex
                : arcTakeIndex) + 1;
            const deck = context
              ? {
                  topic: context.topic,
                  presentationRef: context.presentationRef,
                  slides: context.slides,
                }
              : initArc?.deck;
            writeExploreArc(returnedArcId, nextIdx, deck);
            setArcId(returnedArcId);
            setArcTakeIndex(nextIdx);
          }
        }
        setReadout(result.readout);
        setLabSessionId(result.sessionId);
        setUploadError(null);
        setUploadPaywall(false);
        onRecordingProgress?.(result.recordingProgress);
        goTo("readout");
      } else if (result.kind === "rejected") {
        cancelMic();
        setRejectedMsg(result.message);
        goTo("lab_prerecord");
      } else {
        setUploadError(result.message);
        setUploadPaywall(result.status === 402);
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
          sessionId: labSessionId ?? undefined,
          arcId: arcId ?? undefined,
          takeIndex: recordedTakeRef.current ?? undefined,
          feeling: recordedFeelingRef.current ?? undefined,
          speechRate: hero?.speechRate ?? undefined,
          pauseRatio: hero?.pauseRatio ?? undefined,
        })
      );
    }
  }, [state, context, appendToThread, readout, labSessionId, arcId]);

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
    // Close the overlay FIRST: LabOverlay renders as `fixed inset-0 z-30`, so
    // without this the /signup route navigates invisibly UNDER the still-mounted
    // full-screen layer and the button reads as dead. The park + pending-send
    // stash above already ran synchronously, so nothing is lost by closing now.
    onClose();
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
      {/* Unified X-only header: no status title on any step; the set-up step
          also gets the "Same as last time" re-fill on the left. */}
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        {state === "lab_session_context" && lastSetup ? (
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

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {state === "lab_feelings" && (
          <FeelingsCheckIn onReady={() => goTo("lab_session_context")} />
        )}

        {state === "lab_session_context" && (
          <SessionContextForm
            lastSetup={lastSetup}
            // A staged footer upload is an ad-hoc STANDALONE file — never a take
            // of a persisted arc. Suppress the "Take N of 3" banner + the deck
            // pre-fill (and hide the deck field) so no prior arc bleeds into it.
            applyNonce={applyLastNonce}
            activeArcTake={
              stagedUploadRef.current ? null : arcId ? arcTakeIndex : null
            }
            preloadDeck={stagedUploadRef.current ? null : initArc?.deck ?? null}
            hideDeck={stagedUploadRef.current !== null}
            onExploreChange={setExploreEnabled}
            onSubmit={(ctx, explore) => {
              const staged = stagedUploadRef.current;
              if (staged) {
                // Footer-picked upload: topic now set → submit the file straight
                // through, forced deckless AND standalone, bypassing live-record.
                // Detaching from the arc (exploreEnabled=false, arcId=null) both
                // stops it being filed as a take of a prior/decked arc and makes
                // the success handler skip writeExploreArc, so that arc's cached
                // deck is preserved. The BE gates min content (too-short → 422 →
                // rejected → prerecord).
                stagedUploadRef.current = null;
                setRejectedMsg(null);
                setExploreEnabled(false);
                setArcId(null);
                setContext({ ...ctx, slides: [], presentationRef: null });
                slideAdvancesRef.current = [];
                durationRef.current = 0; // the BE backfills duration from the file
                setBlob(staged);
                goTo("lab_processing");
                return;
              }
              setExploreEnabled(explore);
              setContext(ctx);
              goTo("lab_prerecord");
            }}
          />
        )}

        {state === "lab_prerecord" && (
          <PreRecord
            context={context}
            rejectedMsg={rejectedMsg}
            arcTake={exploreEnabled ? arcTakeIndex : null}
            onRecord={() => {
              setRejectedMsg(null);
              // Invalidate any in-flight upload duration read — the user chose to
              // record instead, so a late resolution must not hijack the flow.
              uploadSeqRef.current += 1;
              void mic.start();
            }}
            onUploadFile={(file) => {
              // Deckless-only alternative to live recording: submit a file the
              // user already has. Skips the mic (no getUserMedia prompt) and the
              // live-record phase; sets the same two things the mic path sets
              // (blob + the already-set context) and jumps to processing, where
              // the existing upload effect fires unchanged. slide_advances stays
              // [] (correct for deckless), so per-slide sync is never faked.
              setRejectedMsg(null);
              const seq = (uploadSeqRef.current += 1);
              // Best-effort local duration pre-check. On failure / non-finite we
              // skip it and let the BE min-content gate be the sole judge (it
              // 422s the same as a too-short live take, surfaced via
              // rejectedMsg). A <video> element reads audio-only files' duration
              // too, so this one reader covers audio + video uploads.
              void readVideoDurationSec(file).then((sec) => {
                // Bail if superseded (newer pick / mic start) or unmounted — a
                // stale read must never force the state machine.
                if (!mountedRef.current || uploadSeqRef.current !== seq) return;
                if (sec != null && sec < MIN_RECORDING_SEC) {
                  setRejectedMsg(
                    `That file is only ${fmtClock(sec)}. We need at least ${fmtClock(
                      MIN_RECORDING_SEC
                    )} of speech for a useful read.`
                  );
                  return;
                }
                // Reset the tap-timeline so a prior live-record attempt in this
                // same overlay session can't leak a fabricated slide_advance
                // into a deckless file upload (submitLabRecording omits []).
                slideAdvancesRef.current = [];
                durationRef.current = sec ?? 0; // 0 is fine — the BE backfills it
                setBlob(file);
                goTo("lab_processing");
              });
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
            arcTake={exploreEnabled ? arcTakeIndex : null}
          />
        )}

        {state === "lab_processing" && (
          <Processing
            error={uploadError}
            paywall={uploadPaywall}
            onRetry={() => {
              setUploadError(null);
              setUploadPaywall(false);
              uploadStartedRef.current = false;
              setRetryNonce((n) => n + 1);
            }}
            onClose={onClose}
          />
        )}

        {state === "readout" && (
          <ReadoutCard
            sessionId={labSessionId}
            payload={
              readout ?? {
                snippets: [],
                overallMessage: null,
                videoRef: null,
                presentationRef: null,
                slides: [],
                slideTranscripts: [],
                fullTranscriptChunks: [],
                voiceMetricsAvailable: true,
                audience: null,
                auditPaid: true,
              }
            }
            onSend={() => goTo(sessionId ? "sendgate_signed" : "sendgate_unsigned")}
            onClose={handleClose}
            managed={false}
            onRegisterBack={(fn) => {
              readoutBackRef.current = fn;
            }}
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
  lastSetup,
  applyNonce,
  activeArcTake,
  preloadDeck,
  hideDeck = false,
  onExploreChange,
  onSubmit,
}: {
  lastSetup: LabSessionContext | null;
  applyNonce: number;
  /** Set when continuing an active arc (take 2+). null = no active arc. */
  activeArcTake: number | null;
  /** When recording another take into a known deck, pre-fill topic + slides +
   *  the already-served PDF so the user doesn't re-enter them. */
  preloadDeck: ExploreArcDeck | null;
  /** Hide the slide-deck field (deckless-only flows, e.g. a footer upload). */
  hideDeck?: boolean;
  onExploreChange: (enabled: boolean) => void;
  onSubmit: (ctx: LabSessionContext, explore: boolean) => void;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  const [slides, setSlides] = useState<PresentationSlide[]>(initialSlides());
  const [presentationRef, setPresentationRef] = useState<string | null>(null);
  // Every recording is an explore (3-take) session — no user toggle. The "3
  // takes" is always on; the BE owns the unlock + arc growth.
  const [explore, setExplore] = useState<boolean>(true);

  // Pre-fill once from the arc's deck (record-another-take into a known deck).
  const didPreloadRef = useRef(false);
  useEffect(() => {
    if (didPreloadRef.current || !preloadDeck) return;
    didPreloadRef.current = true;
    if (preloadDeck.topic) setTopic(preloadDeck.topic);
    if (preloadDeck.slides.length > 0) setSlides(preloadDeck.slides);
    setPresentationRef(preloadDeck.presentationRef);
  }, [preloadDeck]);

  // "Same as last time" — when the header bumps applyNonce, re-fill every field
  // from the last submitted set-up.
  useEffect(() => {
    if (applyNonce <= 0 || !lastSetup) return;
    setTopic(lastSetup.topic);
    setAudience(lastSetup.audience);
    setLengthSec(lastSetup.target_length_seconds);
    setSlides(lastSetup.slides.length > 0 ? lastSetup.slides : initialSlides());
    setPresentationRef(lastSetup.presentationRef);
  }, [applyNonce, lastSetup]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    onSubmit(
      {
        topic: t,
        audience: audience.trim(),
        target_length_seconds: lengthSec,
        domain_vocabulary: [],
        slides: presentationRef ? clampSlides(slides) : nonEmptySlides(slides),
        presentationRef,
      },
      explore
    );
  }

  return (
    <form onSubmit={submit}>
      {/* pb clears the fixed CTA */}
      <div className="pb-24">
        {/* Explore-arc: banner when continuing an active arc, toggle when fresh. */}
        {activeArcTake !== null ? (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-[13px] font-medium text-primary">
              Take {batchTake(activeArcTake)} of 3, same topic
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Same topic as before. Set it up fresh for this take.
            </p>
            <button
              type="button"
              onClick={() => {
                clearExploreArc();
                setExplore(false);
                onExploreChange(false);
              }}
              className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Start a different recording instead
            </button>
          </div>
        ) : null}

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

        {hideDeck ? null : (
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
        )}
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
  arcTake,
  onRecord,
  onUploadFile,
  micState,
}: {
  context: LabSessionContext | null;
  rejectedMsg: string | null;
  /** Current take number when in an explore arc; null for standalone. */
  arcTake: number | null;
  onRecord: () => void;
  /** Deckless-only: supply a pre-made audio/video file instead of recording. */
  onUploadFile: (file: File) => void;
  micState: ReturnType<typeof useDualCaptureMic>["state"];
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Decked talks depend on the live tap-timeline for per-slide word bucketing,
  // which a pre-made file can't produce — so the upload affordance is deckless
  // only (no half-measure / faked slide sync).
  const deckless = context?.slides?.length === 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        {arcTake !== null ? (
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Take {batchTake(arcTake)} of 3
          </p>
        ) : null}
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

      {deckless ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onUploadFile(f);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            or upload a recording instead
          </button>
        </>
      ) : null}

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
  arcTake,
}: {
  micState: ReturnType<typeof useDualCaptureMic>["state"];
  elapsed: number;
  onStop: () => void;
  onRecordAgain: () => void;
  slides: PresentationSlide[];
  presentationRef: string | null;
  currentSlide: number;
  onAdvance: (dir: 1 | -1) => void;
  /** Current take number when in an explore arc; null for standalone. */
  arcTake: number | null;
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
    // Old-iOS standalone PWAs expose no getUserMedia (code "needs_safari") —
    // offer a one-tap hop to Safari (target=_blank from standalone opens the
    // page in Safari, where the mic works). Everyone else just retries.
    // (The old "Open Settings" app-settings: link was dropped — that scheme
    // doesn't open app settings from the web, so it was a dead button.)
    const openInSafari = micState.code === "needs_safari";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] text-destructive">
          {micState.message}
        </p>
        {openInSafari ? (
          <a
            href={typeof window !== "undefined" ? window.location.href : "/"}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-6 py-2.5 text-[15px] text-foreground"
          >
            Open in Safari
          </a>
        ) : (
          <Button onClick={onRecordAgain} variant="outline" className="rounded-full px-6">
            Try again
          </Button>
        )}
      </div>
    );
  }

  const reachedMin = elapsed >= MIN_RECORDING_SEC;
  const remaining = Math.max(0, Math.ceil(MIN_RECORDING_SEC - elapsed));
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

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-destructive">
          <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
          <span className="text-[13px] font-medium">Recording</span>
        </div>
        {arcTake !== null ? (
          <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Take {batchTake(arcTake)} of 3
          </span>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-[40px] font-semibold tabular-nums text-foreground">
          {fmtClock(elapsed)}
        </p>
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

/** C11 — rotate the analyzing line so the wait feels alive (swaps every 3s). */
const PROCESSING_LINES = [
  "Transcribing your voice…",
  "Finding your strongest moments…",
  "Lining up your slides…",
  "Measuring your delivery…",
  "Almost there…",
];

function Processing({
  error,
  paywall,
  onRetry,
  onClose,
}: {
  error: string | null;
  /** True when the failure was a 402 — a paywall is never an error: neutral
   *  styling, no retry (it would just 402 again), a route to the unlock. */
  paywall: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [lineIdx, setLineIdx] = useState(0);
  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setLineIdx((i) => (i + 1) % PROCESSING_LINES.length),
      3000
    );
    return () => clearInterval(id);
  }, [error]);

  if (error && paywall) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] leading-relaxed text-foreground">
          {error}
        </p>
        <div className="flex gap-2">
          <Link
            href="/dashboard/pricing"
            className="flex items-center rounded-full bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Unlock the full audit
          </Link>
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
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] text-destructive">{error}</p>
        <p className="max-w-sm text-[12px] text-muted-foreground">
          Your recording isn&apos;t lost. Try the analysis again, or step back
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
      <p className="flex min-h-[1.5rem] items-center text-[15px] text-foreground">
        {PROCESSING_LINES[lineIdx]}
      </p>
      <p className="max-w-sm text-[12px] text-muted-foreground">
        This usually takes a few seconds.
      </p>
    </div>
  );
}

