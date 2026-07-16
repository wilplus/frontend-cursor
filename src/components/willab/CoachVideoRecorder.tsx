"use client";

import { useEffect, useRef, useState } from "react";
import { Video, Square, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCoachVideoRecorder,
  isCoachVideoRecordingSupported,
  MAX_DURATION_SEC,
  MAX_UPLOAD_BYTES,
} from "@/hooks/useCoachVideoRecorder";

/* -------------------------------------------------------------------------- */
/*  CoachVideoRecorder — in-app camera+mic record flow (FP-2)                  */
/*                                                                            */
/*  A "Record" affordance that sits ALONGSIDE the file input in CoachVideoSlot */
/*  and the per-snippet breakthrough block. Flow:                             */
/*    Record → live preview + timer → Stop → playback → "Use this" / "Retake" */
/*  "Use this" hands the assembled File up to onRecorded, which submits it     */
/*  through the same idempotency/retry/provenance seam as a file pick (with    */
/*  source: 'in-app-recording'). The file-input fallback stays put.           */
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
  /** Fires with the assembled clip when the coach taps "Use this". */
  onRecorded: (file: File) => void;
  /** Parent is busy (uploading) — block starting a new record / using a clip. */
  disabled?: boolean;
  /** Idle-button copy ("Record" vs "Record instead"). */
  label?: string;
}) {
  const rec = useCoachVideoRecorder();
  const previewElRef = useRef<HTMLVideoElement | null>(null);
  // Set when a stopped clip exceeds the upload budget (a VBR overshoot) — we
  // keep the clip so the coach can Retake shorter instead of losing it.
  const [tooBig, setTooBig] = useState(false);

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

  // Feature-gate: no getUserMedia / no encodable container → render nothing, the
  // file input remains the way in.
  if (!isCoachVideoRecordingSupported()) return null;

  const { state } = rec;

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
    );
  }

  // stopped — playback + Use this / Retake
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={state.url}
        controls
        playsInline
        className="w-full rounded-xl bg-black"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            // Guard the ~4.5 MB BFF body limit: a VBR overshoot would 413.
            if (state.file.size > MAX_UPLOAD_BYTES) {
              setTooBig(true);
              return;
            }
            onRecorded(state.file);
            rec.reset();
          }}
          disabled={disabled}
          className="rounded-full"
        >
          <Check className="mr-1.5 h-4 w-4" aria-hidden />
          Use this
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setTooBig(false);
            void rec.start();
          }}
          disabled={disabled}
          className="rounded-full"
        >
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
          Retake
        </Button>
      </div>
      {tooBig ? (
        <p className="text-[12px] text-destructive">
          That clip is a little too large to upload. Retake a shorter one.
        </p>
      ) : null}
    </div>
  );
}
