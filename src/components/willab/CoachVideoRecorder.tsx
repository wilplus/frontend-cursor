"use client";

import { useEffect, useRef } from "react";
import { Video, Square, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCoachVideoRecorder,
  isCoachVideoRecordingSupported,
  MAX_DURATION_SEC,
  MAX_UPLOAD_BYTES,
} from "@/hooks/useCoachVideoRecorder";

/* -------------------------------------------------------------------------- */
/*  CoachVideoRecorder — in-app camera+mic record flow (FP-2, FE-6)            */
/*                                                                            */
/*  A "Record" affordance that sits ALONGSIDE the file input in CoachVideoSlot */
/*  and the per-snippet breakthrough block. Flow (FE-6 — no confirm step):    */
/*    Record → live preview + timer (Stop / Cancel) → stop AUTO-UPLOADS       */
/*  The assembled File goes straight to onRecorded, through the same          */
/*  idempotency/retry/provenance seam as a file pick (source:                 */
/*  'in-app-recording'); the parent renders the upload progress + attached    */
/*  state. Only an oversized clip (VBR overshoot past the BFF body limit)     */
/*  pauses for a Retake. The file-input fallback stays put.                   */
/* -------------------------------------------------------------------------- */

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CoachVideoRecorder({
  onRecorded,
  disabled,
  label = "Record",
}: {
  /** Fires with the assembled clip as soon as recording stops (FE-6). */
  onRecorded: (file: File) => void;
  /** Parent is busy (uploading) — block starting a new recording. */
  disabled?: boolean;
  /** Idle-button copy ("Record" vs "Record instead"). */
  label?: string;
}) {
  const rec = useCoachVideoRecorder();
  const previewElRef = useRef<HTMLVideoElement | null>(null);
  // FE-6 — one auto-submit per assembled clip (guards StrictMode double-run
  // and re-renders while in the stopped state).
  const submittedRef = useRef<File | null>(null);

  // Bind the live stream to the muted preview element while recording.
  useEffect(() => {
    const el = previewElRef.current;
    if (!el) return;
    if (rec.previewStream) {
      el.srcObject = rec.previewStream;
      el.play().catch(() => {
        /* autoplay can reject; the stream is still visible on first frame */
      });
    } else {
      el.srcObject = null;
    }
  }, [rec.previewStream]);

  // FE-6 — auto-upload on stop: the moment the clip is assembled, hand it up
  // and reset to idle (the parent shows "Uploading…" then the attached video).
  // An oversized clip stays on screen for a Retake instead of a doomed 413.
  // While the parent is busy (`disabled` — e.g. a file-input upload already in
  // flight), HOLD the clip instead of submitting: a concurrent submit would
  // clobber the in-flight upload's idempotency key and race two uploads. The
  // effect re-runs when `disabled` clears and submits then.
  const { state, reset } = rec;
  const tooBig =
    state.status === "stopped" && state.file.size > MAX_UPLOAD_BYTES;
  useEffect(() => {
    if (state.status !== "stopped" || tooBig || disabled) return;
    if (submittedRef.current === state.file) return;
    submittedRef.current = state.file;
    onRecorded(state.file);
    reset();
  }, [state, tooBig, disabled, onRecorded, reset]);

  // Feature-gate: no getUserMedia / no encodable container → render nothing, the
  // file input remains the way in.
  if (!isCoachVideoRecordingSupported()) return null;

  if (state.status === "idle") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void rec.start()}
        disabled={disabled}
        className="rounded-full"
      >
        <Video className="mr-1.5 h-4 w-4" aria-hidden />
        {label}
      </Button>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-destructive">{state.message}</p>
        {state.code !== "no_support" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void rec.start()}
            disabled={disabled}
            className="rounded-full"
          >
            <Video className="mr-1.5 h-4 w-4" aria-hidden />
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (state.status === "recording") {
    const remaining = Math.max(0, MAX_DURATION_SEC - state.elapsedSec);
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={previewElRef}
          muted
          playsInline
          className="w-full rounded-xl bg-black"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            {fmt(state.elapsedSec)}
            <span className="font-normal text-muted-foreground">
              · {fmt(remaining)} left
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => rec.reset()}
              className="rounded-full"
            >
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void rec.stop()}
              className="rounded-full"
            >
              <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Stop
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // stopped — normally invisible (the effect auto-uploads + resets). Lands
  // here only for an oversized clip (playback + retake) or while the parent is
  // busy and the submit is on hold.
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={state.url}
        controls
        playsInline
        className="w-full rounded-xl bg-black"
      />
      {tooBig ? (
        <p className="text-[12px] text-destructive">
          That clip is a little too large to upload. Record a shorter one.
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void rec.start()}
        disabled={disabled}
        className="rounded-full"
      >
        <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
        Record again
      </Button>
    </div>
  );
}
