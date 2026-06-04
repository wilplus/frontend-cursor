"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { domainSpec } from "./domains";
import { readWillabProfile } from "./willabProfile";
import type { WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  LabOverlay — the official-recording training zone (§4)                     */
/*                                                                            */
/*  Overlay over the always-mounted Lounge (NOT a route — closing returns to   */
/*  the Lounge with no remount). Distinct "training zone" chrome; holds the    */
/*  mic for its lifetime via useDualCaptureMic and releases it on close.       */
/*                                                                            */
/*  Real front-half (this slice):                                            */
/*    lab_session_context → §4 step A form (topic required; rest pre-filled)   */
/*    lab_prerecord       → task + high-stakes framing + one large record ctrl */
/*    lab_recording       → live capture, timer, min-content gate (≥60s)       */
/*  BE-gated tail (seam ③ — stubbed, walkable for testers):                  */
/*    lab_processing      → SEAM: submitLab(context, blob) → upload + poll     */
/*    readout / sendgate  → §5 / §13, built when the upload handler lands      */
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

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

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
  const mic = useDualCaptureMic();
  const [context, setContext] = useState<LabSessionContext | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const profile = useRef(readWillabProfile()).current;
  const seededVocab = profile ? domainSpec(profile.domain).vocabulary : [];
  const goal = profile?.goal ?? "";

  // Drive flow transitions off the mic state machine.
  useEffect(() => {
    const s = mic.state;
    if (s.status === "recording" && state === "lab_prerecord") {
      goTo("lab_recording");
    }
    if (
      s.status === "stopped" &&
      state === "lab_recording" &&
      s.durationSec >= MIN_RECORDING_SEC
    ) {
      setBlob(s.audioBlob);
      goTo("lab_processing");
    }
  }, [mic.state, state, goTo]);

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

  function handleClose() {
    if (mic.state.status === "recording") {
      if (!window.confirm("Discard this recording? It hasn't been sent.")) return;
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
            onRecord={() => void mic.start()}
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
          <ProcessingSeam blob={blob} sessionId={sessionId} goTo={goTo} />
        )}

        {state === "readout" && (
          <TailStub
            label="Readout (§5)"
            note="The raw acoustic Readout renders here once BE's upload handler returns the §3.3 payload."
            cta="Next → Send gate"
            onCta={() => goTo(sessionId ? "sendgate_signed" : "sendgate_unsigned")}
          />
        )}

        {(state === "sendgate_unsigned" || state === "sendgate_signed") && (
          <TailStub
            label="Send gate (§13)"
            note="Send-to-coach (and sign-up for unsigned sessions) lands with the coach pipeline."
            cta="Back to Lounge"
            onCta={onClose}
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
      domain_vocabulary: vocab
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
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
  onRecord,
  micState,
}: {
  context: LabSessionContext | null;
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

function ProcessingSeam({
  blob,
  sessionId,
  goTo,
}: {
  blob: Blob | null;
  sessionId: string | null;
  goTo: (s: WillabState) => void;
}) {
  // TODO(seam ③): submitLab(context, blob) → multipart upload → poll status →
  // §3.3 Readout payload at readout_ready → goTo("readout") with the data.
  // sessionId scopes the upload when present (signed-in). Until the BE upload
  // handler lands, this is a walkable placeholder.
  void sessionId;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-[15px] text-foreground">Analyzing your recording…</p>
      <p className="max-w-sm text-[12px] text-muted-foreground">
        {blob
          ? `Captured ${(blob.size / 1024).toFixed(0)} KB. Upload + acoustic analysis wires in at BE seam ③.`
          : "No audio captured."}
      </p>
      <button
        type="button"
        onClick={() => goTo("readout")}
        className="rounded-full border border-dashed border-primary/40 px-4 py-1.5 text-[12px] text-primary hover:bg-primary/5"
      >
        [dev] skip to Readout
      </button>
    </div>
  );
}

function TailStub({
  label,
  note,
  cta,
  onCta,
}: {
  label: string;
  note: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="inline-block rounded-full border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
        shell stub · {label}
      </span>
      <p className="max-w-sm text-[15px] text-muted-foreground">{note}</p>
      <Button onClick={onCta} className="rounded-full px-6">
        {cta}
      </Button>
    </div>
  );
}
