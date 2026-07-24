"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Square } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { Button } from "@/components/ui/button";
import { fetchLastSetup } from "./willabLastSetup";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording, fetchGuestLabReadout } from "@/services/api/labRecording";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import { fetchArcSetup } from "@/services/api/arcSetup";
import { takeLabUpload } from "./labUploadStage";
import { validateAudioUpload } from "./audioUploadValidation";
import { useSayItStrongerPolling } from "./useSayItStrongerPolling";
import {
  batchTake,
  coerceTargetSeconds,
  formatRecordingClock,
} from "./willabHelpers";
import { pickPrimingPhrase, type PrimingCondition } from "./primingPhrases";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { useSignedIn } from "./useSignedIn";
import { readoutSummaryDraft } from "./loungeReports";
import { clearParked, readParked, writeParked } from "./willabParked";
import { setPendingSend, setReviewPending } from "./sendStatus";
import type { ReadoutPayload } from "./readout";
import IdealTextReadout from "./IdealTextReadout";
import SendGate from "./SendGate";
import FeelingsCheckIn from "./FeelingsCheckIn";
import { clearFeeling, getLastFeeling, type Feeling } from "./willabFeelings";
import { type WillabState } from "./useWillabFlow";
import { useBackDismiss } from "./useBackDismiss";
import RecordingSetup from "./RecordingSetup";
import SlideStage from "./SlideStage";
import {
  readExploreArc,
  writeExploreArc,
  type ExploreArcDeck,
} from "@/lib/willab/exploreArc";
import {
  writeProcessingTake,
  clearProcessingTake,
} from "@/lib/willab/processingTake";
import { type PresentationSlide } from "./presentation";

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
/*    lab_recording       → live capture, timer (no minimum time — BE-2)        */
/*    lab_processing      → upload (submitLabRecording, §3.3): Readout on 201,   */
/*                          async poll on 202, re-record on 422, error+retry     */
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
  /** ④ step 5 — a free-text strategic-context note (the stakes, the setting,
   *  what the speaker wants to nail) sent as `strategic_context` to sharpen the
   *  coaching. Optional; omitted when blank. */
  strategicContext?: string;
}

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
  const { append: appendToThread, reload: reloadThread } = useLoungeThreadCtx();
  const reportedRef = useRef(false);
  // Timeline order (founder 2026-07-20): each bubble holds its publish moment.
  // The recording bubble is appended when the upload is ACCEPTED (before the
  // analysis finishes), so the BE's ideal-text bubble (analysis end) lands
  // AFTER it, and the "record the next take" line comes last at readout entry.
  const summaryAppendRef = useRef<Promise<unknown> | null>(null);
  const appendRecordingSummary = (sessionId: string | null) => {
    if (reportedRef.current || !context) return;
    reportedRef.current = true;
    summaryAppendRef.current = appendToThread(
      readoutSummaryDraft({
        topic: context.topic,
        recordingId: sessionId ?? undefined,
        sessionId: sessionId ?? undefined,
        arcId: arcId ?? undefined,
        takeIndex: recordedTakeRef.current ?? undefined,
        feeling: recordedFeelingRef.current ?? undefined,
      })
    );
  };
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

  // FE (founder 2026-07-23) — CONTEXT-AWARE OFFICIAL RECORDING: a continued
  // project inherits its full setup from the ARC, not a specific session —
  // topic, audience, target length, slides + the served deck PDF. This is the
  // robust prefill for the in-project "record another take" AND for picking a
  // project from the dashboard, so either drops straight into the recorder
  // with everything set. Owner-only upstream, so signed-in only; a 404 (not
  // owner / no takes) → null → the session/deckless fallbacks below.
  useEffect(() => {
    const aid = initArc?.arcId;
    if (!aid || preloadDeck || signedIn !== true) return;
    let active = true;
    void fetchArcSetup(aid).then((setup) => {
      if (!active || !setup) return;
      setPreloadDeck({
        topic: setup.topic,
        audience: setup.audience,
        presentationRef: setup.presentationRef,
        slides: setup.slides,
        targetLengthSeconds: setup.targetLengthSeconds,
      });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initArc?.arcId, signedIn]);

  // Legacy fallback — restore a continuing arc's deck from a prior SESSION
  // readout when we have a session id but NO arc id (the arc-setup path above
  // owns the project case). Inert until the BE ships `setup`.
  useEffect(() => {
    const sid = initArc?.sessionId;
    if (!sid || preloadDeck || signedIn === null || initArc?.arcId) return;
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
  // Async analysis (delivery layer): the session being polled after a 202
  // accept, and whether the poll has crossed the 3-min "taking longer" cap
  // (the poll keeps going — the cap only swaps the copy + offers re-record).
  const [pollSessionId, setPollSessionId] = useState<string | null>(null);
  const [pollSlow, setPollSlow] = useState(false);
  const pollStartRef = useRef(0);
  // The 202 accept's arc bookkeeping, held back until the analysis actually
  // SUCCEEDS — committing at accept would burn a take slot on a failed
  // analysis (and a retry would then re-submit with an inflated take_index).
  const pendingCarryRef = useRef<{
    returnedArcId: string;
    nextIdx: number;
    deck: ExploreArcDeck | undefined;
    sessionId: string;
  } | null>(null);
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
      readoutEnteredRef.current = false;
      // T8 — start the slide timeline: slide 0 is on screen at t=0. State was
      // already flipped to lab_recording on the Setup submit (optimistic), so
      // there's no goTo here — this only pins t=0 to the real recording start.
      recordStartRef.current = performance.now();
      setCurrentSlide(0);
      slideAdvancesRef.current = [{ index: 0, tMs: 0 }];
    }
    // BE-2/R6-FE5 — no minimum-time gate: every stop submits. The BE analyzes
    // whatever arrived (its min-content 422 is retired server-side too).
    if (s.status === "stopped" && state === "lab_recording") {
      durationRef.current = s.durationSec;
      setBlob(s.audioBlob);
      goTo("lab_processing");
    }
  }, [mic.state, state, goTo]);

  // FE-2 GUARD (founder 2026-07-22) — the recording screen owns the foreground:
  // the mic must NEVER keep running once the screen has moved off it. The mic
  // lives here in LabOverlay and only tears down on stop / cancel / unmount, so
  // if any BACKGROUND actor (a late re-read completion, a status reconcile,
  // a parked restore) moves `state` away from lab_recording while LabOverlay
  // stays mounted, the stream would keep capturing invisibly — the founder's
  // "recording vanished but the mic was still on." This is the airtight
  // backstop: an active recording while the screen is no longer the recorder is
  // an orphan, so cancel it. A normal stop never trips this (mic is "stopped",
  // not "recording", before the state leaves lab_recording).
  useEffect(() => {
    if (mic.state.status === "recording" && state !== "lab_recording") {
      cancelMic();
    }
  }, [mic.state.status, state, cancelMic]);

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
      // Shared arc bookkeeping for the sync (201) and async (202) accept paths:
      // write the returned arc + next take_index (+ deck) to localStorage so the
      // next LabOverlay session picks the arc up.
      const carryArc = (rArcId: string | null, rTakeIdx: number | null) => {
        if (!exploreEnabled) return;
        const returnedArcId = rArcId ?? arcId;
        if (!returnedArcId) return;
        const nextIdx =
          (typeof rTakeIdx === "number" && rTakeIdx > 0 ? rTakeIdx : arcTakeIndex) +
          1;
        const deck = context
          ? {
              topic: context.topic,
              // Persist audience too (review R-car1): on the SAME-project
              // "record another take" the cached deck is reused and the
              // arc-setup fetch is gated out (preloadDeck already set), so the
              // cached deck is the ONLY source of audience for that prefill.
              audience: context.audience || null,
              presentationRef: context.presentationRef,
              slides: context.slides,
              targetLengthSeconds: context.target_length_seconds,
            }
          : initArc?.deck;
        return { returnedArcId, nextIdx, deck };
      };
      const result = await submitLabRecording({
        audioBlob: blob,
        durationSec: durationRef.current,
        topic: context.topic,
        audience: context.audience || undefined,
        targetLengthSeconds: context.target_length_seconds,
        domainVocabulary: context.domain_vocabulary,
        slides: context.slides,
        presentationRef: context.presentationRef,
        strategicContext: context.strategicContext,
        slideAdvances: slideAdvancesRef.current,
        // Explore-arc fields — omitted for standalone recordings.
        exploreSession: exploreEnabled && arcId === null ? true : undefined,
        arcId: arcId ?? undefined,
        takeIndex: exploreEnabled ? arcTakeIndex : undefined,
        // Context-aware setup — the project this take continues, sent
        // ALONGSIDE arc_id/take_index (the deployed BE resolves the arc from
        // those; dropping them for a field it does not read yet would mint a
        // new project on every take).
        continueArcId: arcId ?? undefined,
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
        // localStorage so the next LabOverlay session picks it up. (3-take
        // batch cycle: trust the BE's take_index when present — the BE returns
        // a FRESH arc after 3 takes. FE-1: carry the session id so a later take
        // can restore the setup server-side.)
        const carried = carryArc(result.arcId, result.takeIndex);
        if (carried) {
          writeExploreArc(
            carried.returnedArcId,
            carried.nextIdx,
            carried.deck,
            result.sessionId ?? undefined
          );
          setArcId(carried.returnedArcId);
          setArcTakeIndex(carried.nextIdx);
        }
        appendRecordingSummary(result.sessionId);
        setReadout(result.readout);
        setLabSessionId(result.sessionId);
        setUploadError(null);
        setUploadPaywall(false);
        onRecordingProgress?.(result.recordingProgress);
        goTo("readout");
      } else if (result.kind === "processing") {
        // Async analysis (delivery layer): the BE accepted the upload (202)
        // and finishes the analysis in a background daemon — it now SURVIVES a
        // closed tab / locked phone. Poll the readout until ready/failed; the
        // persisted marker lets the Lounge resume a calm indicator on return.
        // Arc bookkeeping is STASHED, not committed — it only applies when the
        // analysis succeeds (a failed take must not advance the arc, and a
        // retry must reuse the original take_index).
        const carried = carryArc(result.arcId, result.takeIndex);
        pendingCarryRef.current = carried
          ? { ...carried, sessionId: result.sessionId }
          : null;
        appendRecordingSummary(result.sessionId);
        setLabSessionId(result.sessionId);
        setUploadError(null);
        setUploadPaywall(false);
        writeProcessingTake({
          sessionId: result.sessionId,
          arcId: result.arcId ?? arcId,
          takeIndex:
            result.takeIndex ?? (exploreEnabled ? arcTakeIndex : null),
          startedAt: Date.now(),
        });
        setPollSessionId(result.sessionId);
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

  // Async analysis poll (delivery layer): every ~2s until the daemon flips the
  // session to ready (→ readout) or failed (→ retry). Null responses (network
  // blips) just keep polling; past 3 min the copy flips to "taking longer" but
  // the poll continues — the analysis genuinely finishes server-side.
  useEffect(() => {
    if (!pollSessionId || state !== "lab_processing") return;
    pollStartRef.current = Date.now();
    setPollSlow(false);
    let active = true;
    const tick = async () => {
      const r = await fetchGuestLabReadout(pollSessionId);
      if (!active) return;
      if (r) {
        const hasContent =
          r.readout.snippets.length > 0 ||
          r.readout.instantChunks.length > 0 ||
          r.readout.fullTranscriptChunks.length > 0;
        if (r.state === "failed") {
          // Discard the stashed arc bookkeeping — a failed take must not
          // advance the arc, so the retry reuses the original take_index.
          pendingCarryRef.current = null;
          clearProcessingTake(pollSessionId);
          setPollSessionId(null);
          setPollSlow(false);
          setUploadError(
            "The analysis hit a snag on our side. Your recording is safe. Try again."
          );
          return;
        }
        if (
          r.state === "ready" ||
          r.state === "readout_ready" ||
          (r.state !== "processing" && hasContent)
        ) {
          // Success — NOW commit the arc bookkeeping stashed at the 202 accept.
          const carried = pendingCarryRef.current;
          if (carried && carried.sessionId === pollSessionId) {
            writeExploreArc(
              carried.returnedArcId,
              carried.nextIdx,
              carried.deck,
              carried.sessionId
            );
            setArcId(carried.returnedArcId);
            setArcTakeIndex(carried.nextIdx);
          }
          pendingCarryRef.current = null;
          clearProcessingTake(pollSessionId);
          setPollSessionId(null);
          setPollSlow(false);
          setReadout(r.readout);
          setUploadError(null);
          goTo("readout");
          return;
        }
      }
      if (Date.now() - pollStartRef.current > 180_000) setPollSlow(true);
    };
    void tick(); // immediate first read — a fast daemon shouldn't wait 2s
    const id = setInterval(() => void tick(), 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollSessionId, state, goTo]);

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
  const readoutEnteredRef = useRef(false);
  useEffect(() => {
    if (state === "readout" && context && !readoutEnteredRef.current) {
      readoutEnteredRef.current = true;
      // The recording bubble was already appended at upload-accept (event
      // order). Here: pull the BE's ideal-text bubble (inserted at analysis
      // end), THEN the nudge line, so the thread reads recording → ideal text
      // → "record the next take". The reload chains after the summary POST —
      // reload() wholesale-replaces the list, so running it early would wipe
      // the optimistic bubble (review R-cb2). A parked restore (summary
      // already persisted, ref null) skips straight to the reload.
      void (summaryAppendRef.current ?? Promise.resolve())
        .then(() => reloadThread())
        .then(() => {
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
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <RecordingSetup
            lastSetup={lastSetup}
            applyNonce={applyLastNonce}
            // Context document attaches to the arc; a staged standalone upload
            // is detached (arc nulled on submit), so suppress the field there —
            // same guard as preloadDeck. Also signed-in only: the endpoint is
            // owner-scoped and 401s without a token, and a guest can still hold
            // a locally-cached arcId, so gate on signedIn like the arc prefill.
            contextArcId={
              stagedUploadRef.current || signedIn !== true ? null : arcId
            }
            // A staged footer upload is a STANDALONE file, never a take of a
            // persisted arc: skip the deck pre-fill and hide the slide step so
            // no prior arc bleeds into it.
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
              // SD — the priming panel (threat/challenge framing) is deleted:
              // the submit click IS the user gesture getUserMedia needs, so the
              // mic starts right here and recording begins immediately.
              setExploreEnabled(explore);
              setContext(ctx);
              setRejectedMsg(null);
              uploadSeqRef.current += 1; // drop any stale upload-duration read
              primingRef.current = null;
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
            arcTake={null}
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
            slow={pollSlow}
            onRetry={() => {
              setUploadError(null);
              setUploadPaywall(false);
              setPollSlow(false);
              uploadStartedRef.current = false;
              setRetryNonce((n) => n + 1);
            }}
            onReRecord={() => {
              // Abandon the slow analysis (the daemon still finishes it server-
              // side; the marker + Lounge indicator keep tracking it) and take
              // the user back through priming → mic for a fresh take. The
              // stashed arc bookkeeping goes with it — the abandoned take must
              // not advance the arc.
              pendingCarryRef.current = null;
              setPollSessionId(null);
              setPollSlow(false);
              uploadStartedRef.current = false;
              setBlob(null);
              primingRef.current = null;
              startPendingRef.current = true;
              goTo("lab_recording");
              void mic.start();
            }}
            onClose={onClose}
          />
        )}

        {/* SD — the post-recording screen IS the ideal text 1.0: suggestions
            auto-applied, editable, pending-verification badge; delivery to the
            coach is automatic (no Approve rows, no Send button). Replaces the
            per-piece approve walker (ReadoutCard). */}
        {state === "readout" && (
          <IdealTextReadout
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
            sessionId={labSessionId}
            arcId={arcId}
            signedIn={signedIn}
            onAutoSent={() => {
              // Mirrors the old SendGate.onSent bookkeeping, minus the screen
              // change: the user stays on their ideal text.
              clearParked();
              if (labSessionId) setReviewPending(labSessionId);
            }}
            onSignUp={() => goTo("sendgate_unsigned")}
            onReRead={() => {
              // A re-read is just the next take on THIS presentation: keep the
              // deck (context) and arc (arcTakeIndex was already advanced on the
              // prior upload), drop the current take's readout/session/blob, and
              // drop back to the mic. The BE reconciles the real take index on
              // upload. Clear the parked readout so it can't restore over the
              // new take; startPendingRef lets the mic-state effect re-init the
              // slide timeline at the real recording start.
              clearParked();
              setReadout(null);
              setLabSessionId(null);
              setBlob(null);
              uploadStartedRef.current = false;
              pendingCarryRef.current = null;
              setPollSessionId(null);
              setPollSlow(false);
              primingRef.current = null;
              startPendingRef.current = true;
              goTo("lab_recording");
              void mic.start();
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

/* ---------------- §4 step A.5: pre-take priming panel (R5) ---------------- */

/* One-layer mindset-priming panel between Setup and the mic, shown on every
 * take: one framing phrase (threat / challenge / balanced by batch position,
 * one picked at random) + a proceed button. The proceed click is the user
 * gesture the mic needs, so the parent starts recording from it. The shown
 * condition + phrase is reported back so the upload can log it. (R6-FE6: the
 * parabola/intro explainer screen that preceded this was deleted — the panel
 * is the single pre-take screen again.) */
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

  // R5 — Apple-style clock: count DOWN from the setup target, read 0:00 at the
  // target, then count UP as a negative red overrun (never auto-stopping — the
  // red is only a nudge). No/invalid target → count up raw elapsed, never red.
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

      {/* BE-2/R6-FE5 — stop is always available; there is no minimum recording
          time anywhere (the old 60s lock + too-short prompts are gone). */}
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop recording"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-transform hover:scale-105"
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
  slow = false,
  onRetry,
  onReRecord,
  onClose,
}: {
  error: string | null;
  /** True when the failure was a 402 — a paywall is never an error: neutral
   *  styling, no retry (it would just 402 again), a route to the unlock. */
  paywall: boolean;
  /** Async analysis: the poll crossed the 3-min cap — swap to the calm
   *  "taking longer than usual" copy + offer a re-record. Never an error. */
  slow?: boolean;
  onRetry: () => void;
  /** Abandon a slow analysis and record a fresh take (priming → mic). */
  onReRecord?: () => void;
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

  if (!error && slow) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="max-w-sm text-[15px] leading-relaxed text-foreground">
          This is taking longer than usual. Your recording is safe and the
          analysis keeps running on our side, even if you close this.
        </p>
        <div className="flex gap-2">
          {onReRecord ? (
            <Button onClick={onReRecord} className="rounded-full px-6">
              Record again
            </Button>
          ) : null}
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

