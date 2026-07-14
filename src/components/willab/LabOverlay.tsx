"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Square } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchLastSetup } from "./willabLastSetup";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording, fetchGuestLabReadout } from "@/services/api/labRecording";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import { takeLabUpload } from "./labUploadStage";
import { validateAudioUpload } from "./audioUploadValidation";
import { useSayItStrongerPolling } from "./useSayItStrongerPolling";
import { domainSpec } from "./domains";
import { readWillabProfile } from "./willabProfile";
import {
  batchTake,
  coerceTargetSeconds,
  fmtClock,
  formatRecordingClock,
} from "./willabHelpers";
import { pickPrimingPhrase, type PrimingCondition } from "./primingPhrases";
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
/*    lab_session_context → §4 step A form (topic required)                    */
/*    lab_prerecord       → R5 one-layer priming panel (threat/challenge/       */
/*                          balanced phrase + "I'm ready"); its tap starts mic  */
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
  { label: "30 min", sec: 1800 },
  { label: "45 min", sec: 2700 },
  { label: "60 min", sec: 3600 },
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
  // Device Back must agree with the X: closing DURING the readout PARKS the
  // recording (hold, don't discard — §4), never a raw close that loses it.
  // useBackDismiss stores the latest closure in a ref, so this is safe.
  const suppressBackOnClose = useBackDismiss(
    () => {
      if (state === "readout") {
        parkReadout();
        return;
      }
      mic.cancel();
      onClose();
    },
    () => (state === "readout" ? readoutBackRef.current?.() ?? false : false)
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
  // R4-5 — the Pre-record screen was removed: the Setup "Start recording" submit
  // now starts the mic directly and flips to lab_recording optimistically. This
  // flags the one pending initial start so the mic-state effect inits the slide
  // timeline at the ACTUAL recording start (precise t=0), exactly once.
  const startPendingRef = useRef(false);
  // R4-5 fix — true when the take being processed came from a file upload (not
  // a live recording), so a BE rejection (422) offers "upload a different file"
  // instead of only "record again" (an upload user may not want to speak now).
  const lastWasUploadRef = useRef(false);
  // R5 — the framing condition + phrase shown on the pre-take priming panel,
  // stashed at proceed so the upload can log it (BE correlates framing → read).
  const primingRef = useRef<{ condition: PrimingCondition; phrase: string } | null>(
    null
  );

  // Explore-arc state (Prompt B §F2). Read from localStorage on mount so the
  // arc_id carries across LabOverlay sessions (Lounge → Lab → Lounge → Lab…).
  // initArc is stable for the overlay's lifetime; state mirrors it for renders.
  const initArc = useRef(readExploreArc()).current;
  const [arcId, setArcId] = useState<string | null>(initArc?.arcId ?? null);
  const [arcTakeIndex, setArcTakeIndex] = useState<number>(
    initArc?.nextTakeIndex ?? 1
  );
  const [exploreEnabled, setExploreEnabled] = useState<boolean>(!!initArc);
  // FE-1 — the deck to pre-fill the setup form with. Starts from localStorage
  // (initArc.deck) and is backfilled from the server below when the cache lost
  // it, so take 2+ restores its slides instead of dead-ending / going deckless.
  const [preloadDeck, setPreloadDeck] = useState<ExploreArcDeck | null>(
    initArc?.deck ?? null
  );

  // FE-1 — restore a continuing arc's deck from the server when localStorage
  // lost it: if we have the arc's session id but no cached deck, re-read that
  // session and adopt its `setup` (slides + served PDF). Inert until the BE
  // ships `setup` (r.setup is null → no-op → today's deckless behavior).
  useEffect(() => {
    const sid = initArc?.sessionId;
    if (!sid || preloadDeck || signedIn === null) return;
    let active = true;
    const fetcher = signedIn ? fetchSessionReadout : fetchGuestLabReadout;
    void fetcher(sid).then((r) => {
      if (!active || !r?.setup) return;
      setPreloadDeck({
        topic: r.setup.topic,
        presentationRef: r.setup.presentationRef,
        slides: r.setup.slides,
        // R5 fix — restore the set length so take 2/3 keeps the countdown.
        targetLengthSeconds: r.setup.target_length_seconds,
      });
    });
    return () => {
      active = false;
    };
    // preloadDeck intentionally excluded: this runs once auth resolves, and the
    // guard reads the initial (null) value — backfilling it must not re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initArc?.sessionId, signedIn]);

  // Upload → Readout (seam ③).
  const [readout, setReadout] = useState<ReadoutPayload | null>(null);
  const [labSessionId, setLabSessionId] = useState<string | null>(null);
  // Bug 4 — the Say It Stronger cards generate a few seconds after the readout
  // loads; poll until they land (no-ops once every snippet has resolved, or
  // outside the readout state since labSessionId/readout are both null then).
  useSayItStrongerPolling(labSessionId, signedIn, readout, setReadout);
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
    if (s.status === "recording" && startPendingRef.current) {
      startPendingRef.current = false;
      reportedRef.current = false; // fresh recording → allow a new history entry
      // T8 — start the slide timeline: slide 0 is on screen at t=0. State was
      // already flipped to lab_recording on the Setup submit (optimistic), so
      // there's no goTo here — this only pins t=0 to the real recording start.
      recordStartRef.current = performance.now();
      setCurrentSlide(0);
      slideAdvancesRef.current = [{ index: 0, tMs: 0 }];
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
    // C7 — capture the named feeling for this take, then clear the active value.
    // Only overwrite when a fresh value is present so a retry / re-record
    // re-running this effect (the active key is already cleared) can't null out
    // the capture.
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
        // R5 — the framing manipulation shown on the priming panel, logged for
        // the threat/challenge/balanced correlation. undefined for uploads
        // (they skip the panel).
        primingCondition: primingRef.current?.condition,
        primingPhrase: primingRef.current?.phrase,
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
                  // R5 fix — carry the set length so the next take's timer keeps
                  // counting down from it.
                  targetLengthSeconds: context.target_length_seconds,
                }
              : initArc?.deck;
            // FE-1 — carry this take's session id so a later take can restore
            // the arc's setup from the server if localStorage loses the deck.
            writeExploreArc(
              returnedArcId,
              nextIdx,
              deck,
              result.sessionId ?? undefined
            );
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
        // R4-5 — the min-content gate (422) used to send the user back to the
        // Pre-record screen. That screen is gone, so surface the message in
        // RecordingPhase (which keeps the setup context) and let "Record again"
        // restart the mic. cancelMic resets to idle; the rejection guard shows
        // the message rather than a connecting spinner.
        cancelMic();
        setRejectedMsg(result.message);
        goTo("lab_recording");
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
      // After the batch's FIRST take, one short informational bubble that the
      // next take is up.
      if (
        exploreEnabled &&
        recordedTakeRef.current !== null &&
        batchTake(recordedTakeRef.current) === 1
      ) {
        void appendToThread({
          role: "bot",
          kind: "text",
          body: "When you're ready, record the next take.",
        });
      }
    }
  }, [state, context, appendToThread, readout, labSessionId, arcId, exploreEnabled]);

  // Park the held Readout (persist + route to the Lounge's parked chip).
  function parkReadout() {
    if (readout) {
      writeParked({ sessionId: labSessionId, topic: context?.topic ?? "", readout });
    }
    goTo("parked");
  }

  // Unsigned send (§13 Path 2, amended): park + stash the id, then navigate to
  // /signup — the SIGN-UP (create-account) view. A non-registered guest who
  // just recorded their first take needs "create account" (Google/LinkedIn/
  // email), not a sign-in form; /signup leads with account creation and keeps
  // "already have an account? sign in" as the secondary link. The resume
  // mechanism is unchanged: the global <WillabPendingSend> reads the pending
  // id on any post-auth landing (SIGNED_IN event from any provider) and runs
  // merge-then-send.
  function startUnsignedSend() {
    if (readout && labSessionId) {
      writeParked({ sessionId: labSessionId, topic: context?.topic ?? "", readout });
      setPendingSend(labSessionId);
    }
    // Suppress useBackDismiss's unmount history.back() BEFORE we close +
    // navigate. LabOverlay pushes a throwaway history entry while open and
    // pops it on unmount; without this suppressor that pop fires right after
    // router.push("/signup") and reverses it, landing the user back on /chat
    // (the "sign-in goes to chat, not the auth screen" bug). onClose() still
    // runs so the flow state resets (the overlay won't re-open when they
    // return).
    suppressBackOnClose();
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
        <OverlayCloseButton onClick={handleClose} />
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
            preloadDeck={stagedUploadRef.current ? null : preloadDeck}
            hideDeck={stagedUploadRef.current !== null}
            onSubmit={(ctx, explore) => {
              const staged = stagedUploadRef.current;
              if (staged) {
                // Footer-picked upload: topic now set → submit the file straight
                // through, forced deckless AND standalone, bypassing live-record.
                // Detaching from the arc (exploreEnabled=false, arcId=null) both
                // stops it being filed as a take of a prior/decked arc and makes
                // the success handler skip writeExploreArc, so that arc's cached
                // deck is preserved. The BE gates min content (too-short → 422 →
                // the lab_recording rejected screen, which offers a re-upload).
                stagedUploadRef.current = null;
                lastWasUploadRef.current = true;
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
              lastWasUploadRef.current = false;
              // R5 — a live take goes through the priming panel (one framing
              // phrase + proceed) BEFORE the mic. The panel's proceed button is
              // the user gesture getUserMedia needs, so mic.start() fires there.
              setExploreEnabled(explore);
              setContext(ctx);
              setRejectedMsg(null);
              uploadSeqRef.current += 1; // drop any stale upload-duration read
              goTo("lab_prerecord");
            }}
          />
        )}

        {state === "lab_prerecord" && (
          <PrimingPanel
            batchTake={batchTake(arcTakeIndex)}
            onProceed={(condition, phrase) => {
              // R5 — stash the shown framing for the upload log, then start the
              // mic straight from this click (gesture preserved) and flip to
              // lab_recording optimistically; the mic-state effect pins t=0.
              primingRef.current = { condition, phrase };
              startPendingRef.current = true;
              goTo("lab_recording");
              void mic.start();
            }}
          />
        )}

        {state === "lab_recording" && (
          <RecordingPhase
            micState={mic.state}
            elapsed={elapsed}
            targetSec={context?.target_length_seconds ?? null}
            rejectedMsg={rejectedMsg}
            onStop={() => void mic.stop()}
            onRecordAgain={() => {
              // A retake restarts the clock: reset the tap timeline so a decked
              // retake (mic self-stop) can't ship stale slide timestamps. This
              // path inits the timeline itself, so clear the initial-start flag
              // to keep the mic-state effect from re-initing it. Also clears any
              // BE-rejection message (R4-5) so the recording UI shows cleanly.
              // This is a LIVE take now, so a later rejection isn't an upload.
              setRejectedMsg(null);
              lastWasUploadRef.current = false;
              startPendingRef.current = false;
              recordStartRef.current = performance.now();
              setCurrentSlide(0);
              slideAdvancesRef.current = [{ index: 0, tMs: 0 }];
              void mic.start();
            }}
            slides={context?.slides ?? []}
            presentationRef={context?.presentationRef ?? null}
            currentSlide={currentSlide}
            onAdvance={advanceSlide}
            arcTake={exploreEnabled ? arcTakeIndex : null}
            // R4-5 fix — a rejected UPLOAD offers "upload a different file"
            // (the context is already deckless-standalone, so just re-submit
            // the new blob). Live-recorded rejections keep "Record again" only.
            uploadRetry={
              lastWasUploadRef.current
                ? (file) => {
                    const err = validateAudioUpload(file);
                    if (err) {
                      setRejectedMsg(err);
                      return;
                    }
                    setRejectedMsg(null);
                    slideAdvancesRef.current = [];
                    durationRef.current = 0; // the BE backfills duration
                    setBlob(file);
                    goTo("lab_processing");
                  }
                : null
            }
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
                instantChunks: [],
                voiceMetricsAvailable: true,
                parentAudioRef: null,
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
  onSubmit: (ctx: LabSessionContext, explore: boolean) => void;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  const [slides, setSlides] = useState<PresentationSlide[]>(initialSlides());
  const [presentationRef, setPresentationRef] = useState<string | null>(null);
  // Every recording is an explore (3-take) session — no user toggle. The "3
  // takes" is always on; the BE owns the unlock + arc growth. (FE-4 removed
  // the only opt-out, so this is a constant now — kept as state for the
  // stable onSubmit signature.)
  const [explore] = useState<boolean>(true);

  // Pre-fill once from the arc's deck (record-another-take into a known deck).
  const didPreloadRef = useRef(false);
  useEffect(() => {
    if (didPreloadRef.current || !preloadDeck) return;
    didPreloadRef.current = true;
    if (preloadDeck.topic) setTopic(preloadDeck.topic);
    if (preloadDeck.slides.length > 0) setSlides(preloadDeck.slides);
    setPresentationRef(preloadDeck.presentationRef);
    // R5 fix — restore the set length so take 2/3's timer counts down from it
    // instead of resetting to no-limit (a stopwatch that only counts up).
    if (preloadDeck.targetLengthSeconds != null) {
      setLengthSec(preloadDeck.targetLengthSeconds);
    }
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
        {/* Explore-arc: a bare take indicator when continuing an active arc.
            FE-4 — no framing copy or opt-out; every recording is a 3-take
            batch, so the orange TAKE N OF 3 line is all that's needed. */}
        {activeArcTake !== null ? (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-[13px] font-medium text-primary">
              Take {batchTake(activeArcTake)} of 3
            </p>
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

/* ---------------- §4 step A.5: pre-take priming panel (R5) ---------------- */

/* A schematic 3-phase "swing" curve for the priming intro: the line dips down
 * (threat), rises up (challenge), then settles flat at a neutral midline
 * (balanced). Purely illustrative — it sets the mood for the framing that
 * follows, carries no numbers. Theme-aware via currentColor. */
function PrimingSwing() {
  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label="A line that dips down, rises up, then settles flat"
      className="h-auto w-full max-w-[320px]"
    >
      {/* neutral midline the swing settles onto */}
      <line
        x1="10"
        y1="78"
        x2="310"
        y2="78"
        className="stroke-border"
        strokeWidth="1"
        strokeDasharray="4 5"
      />
      {/* the swing: dip (threat) → crest (challenge) → settle flat (neutral) */}
      <path
        d="M12,78 C40,86 60,126 84,126 C112,126 140,30 168,30 C196,30 220,78 246,78 L308,78"
        fill="none"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* phase markers */}
      <circle cx="84" cy="126" r="4" className="fill-primary" />
      <circle cx="168" cy="30" r="4" className="fill-primary" />
      <circle cx="277" cy="78" r="4" className="fill-primary" />
    </svg>
  );
}

/* One-layer mindset-priming panel between Setup and the mic. Two minimal steps,
 * shown on every take:
 *   1. intro  — a schematic swing graphic + a short "this is part of the
 *               training, it shifts your mindset" explainer + a single Next.
 *   2. phrase — one framing phrase (threat / challenge / balanced by batch
 *               position, one picked at random) + a proceed button.
 * The proceed click is the user gesture the mic needs, so the parent starts
 * recording from it. The shown condition + phrase is reported back so the
 * upload can log it. */
function PrimingPanel({
  batchTake,
  onProceed,
}: {
  /** Position within the 3-take batch (1/2/3) → threat/challenge/balanced. */
  batchTake: number;
  onProceed: (condition: PrimingCondition, phrase: string) => void;
}) {
  // Pick once per mount (a re-render must not re-roll the phrase).
  const [picked] = useState(() => pickPrimingPhrase(batchTake));
  const [step, setStep] = useState<"intro" | "phrase">("intro");

  if (step === "intro") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <PrimingSwing />
        <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
          What&apos;s next is a deliberate part of the training. It&apos;s
          designed to shift your mindset before you speak, so read it carefully
          and trust the process.
        </p>
        <Button
          type="button"
          onClick={() => setStep("phrase")}
          className="h-12 rounded-full px-8 text-[15px] font-medium"
        >
          Next
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="max-w-md text-[20px] font-semibold leading-relaxed text-foreground">
        {picked.phrase}
      </p>
      <Button
        type="button"
        onClick={() => onProceed(picked.condition, picked.phrase)}
        className="h-12 rounded-full px-8 text-[15px] font-medium"
      >
        I&apos;m ready
      </Button>
    </div>
  );
}

/* ------------------------- §4 step B: recording -------------------------- */

function RecordingPhase({
  micState,
  elapsed,
  targetSec,
  rejectedMsg,
  uploadRetry,
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
  /** R5 — the target length from setup (seconds, may arrive as a string). The
   *  clock counts DOWN to it, then UP as a red negative overrun; null/invalid →
   *  plain count-up stopwatch. Coerced via formatRecordingClock. */
  targetSec: number | string | null;
  /** R4-5 — the BE min-content rejection (422); shown here now that the
   *  Pre-record screen is gone. "Record again" restarts the mic. */
  rejectedMsg: string | null;
  /** R4-5 fix — when the rejected take was an UPLOAD, submit a different file
   *  instead of forcing a live re-record. null for live-recorded rejections. */
  uploadRetry: ((file: File) => void) | null;
  onStop: () => void;
  onRecordAgain: () => void;
  slides: PresentationSlide[];
  presentationRef: string | null;
  currentSlide: number;
  onAdvance: (dir: 1 | -1) => void;
  /** Current take number when in an explore arc; null for standalone. */
  arcTake: number | null;
}) {
  const retryFileRef = useRef<HTMLInputElement | null>(null);
  // R4-5 — the BE rejected the last take (too short / no clear speech). Keep the
  // setup context and let the user re-record without re-entering Setup. This
  // wins over the connecting/idle spinner (cancelMic left the mic idle). When
  // the take came from a file upload, lead with "upload a different file"
  // (the old Pre-record recovery) and keep live recording as the alternative.
  if (rejectedMsg) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] text-destructive">{rejectedMsg}</p>
        {uploadRetry ? (
          <>
            <input
              ref={retryFileRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadRetry(f);
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={() => retryFileRef.current?.click()}
                className="rounded-full px-6"
              >
                Upload a different file
              </Button>
              <button
                type="button"
                onClick={onRecordAgain}
                className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                or record instead
              </button>
            </div>
          </>
        ) : (
          <Button onClick={onRecordAgain} className="rounded-full px-6">
            Record again
          </Button>
        )}
      </div>
    );
  }

  // R4-5 — with the Pre-record screen gone, RecordingPhase is what shows while
  // getUserMedia is still resolving (status "idle" after the Setup submit fired
  // mic.start()). Show a brief connecting state so it never reads "Recording"
  // before the mic is actually live.
  if (micState.status === "idle") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <p className="text-[15px] text-muted-foreground">
          Getting your mic ready…
        </p>
      </div>
    );
  }

  // Too-short re-record prompt (min-content gate).
  if (micState.status === "stopped" && micState.durationSec < MIN_RECORDING_SEC) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-[17px] font-semibold text-foreground">
          That was only {fmtClock(micState.durationSec)}
        </p>
        <p className="max-w-sm text-[15px] text-muted-foreground">
          We need at least {fmtClock(MIN_RECORDING_SEC)} of speech for a useful
          read. Nothing was sent, so give it another go.
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
  // R5 — Apple-style clock: count DOWN from the setup target, read 0:00 at the
  // target, then count UP as a negative red overrun (never auto-stopping — the
  // red is only a nudge). No/invalid target → count up raw elapsed, never red.
  // The 60s min-content gate still governs the stop button independently.
  const { label: clockLabel, overrun } = formatRecordingClock(elapsed, targetSec);
  const target = coerceTargetSeconds(targetSec); // for the bar fill only
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

      {/* R5 — Apple-style countdown → red negative overrun (e.g. -0:36), on
          EVERY take. Below it, a NUMBERLESS progress bar fills toward the target
          and turns red + pulses once past it (no digits / no %, AC-9). No target
          → count up + a neutral pulsing bar. */}
      <div className="flex flex-col items-center gap-2.5">
        <p
          className={`text-[40px] font-semibold tabular-nums ${
            overrun ? "text-destructive" : "text-foreground"
          }`}
        >
          {clockLabel}
        </p>
        <div
          className="h-1.5 w-56 max-w-[70vw] overflow-hidden rounded-full bg-border"
          aria-hidden
        >
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${
              overrun
                ? "animate-pulse bg-destructive"
                : target == null
                  ? "animate-pulse bg-muted-foreground/40"
                  : "bg-primary"
            }`}
            style={{
              width:
                target == null
                  ? "100%"
                  : `${Math.min(100, (elapsed / target) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* U11 — the stop control is LOCKED until the 60s minimum is reached, so
          a recording can't be ended too short (FE enforcement of the §3.3/§5.5
          min-content gate). Independent of the target countdown above; the
          button is disabled + visually muted until then. */}
      <button
        type="button"
        onClick={onStop}
        disabled={!reachedMin}
        aria-label={
          reachedMin ? "Stop recording" : "Keep recording a little longer"
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
    // FE-5 — pricing/paywall overlay: exit is the header X + the back gesture
    // only (consistent with every other overlay). The stray in-body "Back to
    // Lounge" button was removed; "Unlock the full audit" is the sole action.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-[15px] leading-relaxed text-foreground">
          {error}
        </p>
        <Link
          href="/dashboard/pricing"
          className="flex items-center rounded-full bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Unlock the full audit
        </Link>
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

