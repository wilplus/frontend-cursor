"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording } from "@/services/api/labRecording";
import { domainSpec } from "./domains";
import { readWillabProfile } from "./willabProfile";
import { fmtClock, parseVocabulary } from "./willabHelpers";
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
  const router = useRouter();
  const mic = useDualCaptureMic();
  const { cancel: cancelMic } = mic;
  const signedIn = useSignedIn();
  const [context, setContext] = useState<LabSessionContext | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [elapsed, setElapsed] = useState(0);
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
  const goal = profile?.goal ?? "";

  // Drive flow transitions off the mic state machine.
  useEffect(() => {
    const s = mic.state;
    if (s.status === "recording" && state === "lab_prerecord") {
      reportedRef.current = false; // fresh recording → allow a new history entry
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
      {/* §4 training-zone chrome */}
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
            goal={goal}
            seededVocab={seededVocab}
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
            payload={readout ?? { snippets: [], overallMessage: null, videoRef: null }}
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

function SessionContextForm({
  goal,
  seededVocab,
  onSubmit,
}: {
  goal: string;
  seededVocab: string[];
  onSubmit: (ctx: LabSessionContext) => void;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  const [vocab, setVocab] = useState(seededVocab.join(", "));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    onSubmit({
      topic: t,
      audience: audience.trim(),
      target_length_seconds: lengthSec,
      domain_vocabulary: parseVocabulary(vocab),
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-semibold text-foreground">
          Set up your recording
        </h2>
        {goal ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Your goal: {goal}
          </p>
        ) : null}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">
          What are you speaking on? <span className="text-primary">*</span>
        </span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. my Q3 results pitch"
          className="rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">
          Audience <span className="text-muted-foreground">(optional)</span>
        </span>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. the leadership team"
          className="rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">
          Target length <span className="text-muted-foreground">(optional)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {LENGTH_PRESETS.map((p) => {
            const active = lengthSec === p.sec;
            return (
              <button
                key={p.sec}
                type="button"
                onClick={() => setLengthSec(active ? null : p.sec)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">
          Words we should expect{" "}
          <span className="text-muted-foreground">(helps transcription)</span>
        </span>
        <input
          value={vocab}
          onChange={(e) => setVocab(e.target.value)}
          placeholder="comma-separated terms"
          className="rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
        />
      </label>

      <div className="mt-auto">
        <Button
          type="submit"
          disabled={!topic.trim()}
          className="w-full rounded-full"
        >
          Continue
        </Button>
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
}: {
  micState: ReturnType<typeof useDualCaptureMic>["state"];
  elapsed: number;
  onStop: () => void;
  onRecordAgain: () => void;
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
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex items-center gap-2 text-destructive">
        <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
        <span className="text-[13px] font-medium">Recording</span>
      </div>

      <p className="text-[40px] font-semibold tabular-nums text-foreground">
        {fmtClock(elapsed)}
      </p>
      <p className="text-[12px] text-muted-foreground">
        {reachedMin
          ? "Minimum reached — stop whenever you're ready."
          : `Keep going — at least ${fmtClock(MIN_RECORDING_SEC)}.`}
      </p>

      <button
        type="button"
        onClick={onStop}
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-transform hover:scale-105"
        aria-label="Stop recording"
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

