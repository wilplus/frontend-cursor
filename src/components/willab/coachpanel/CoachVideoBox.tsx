"use client";

/* -------------------------------------------------------------------------- */
/*  The video step's one box (founder lock 2026-10-06, flow step 9: "Your     */
/*  video. Record (one action)"), as the prototype draws it: a dark box that  */
/*  says "Camera" before the recording, shows the live picture with the red   */
/*  dot and the clock while it records, and plays the clip once it is kept.   */
/*  The footer (Record, Stop, Keep, Save, Record again) is the screen's own,  */
/*  through WalkFooter. The recorder is useCoachVideoRecorder's.              */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CoachVideoRecorder } from "@/hooks/useCoachVideoRecorder";
import CoachVideo from "../CoachVideo";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

const BOX = "relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#30343c,#17191e)] text-[14px] text-[#cfd3db]";

export default function CoachVideoBox({ recorder, tall = false }: {
  recorder: CoachVideoRecorder;
  /** The portrait box of an exercise's video (4:5); else 16:9. */
  tall?: boolean;
}) {
  const preview = useRef<HTMLVideoElement | null>(null);
  const { state, previewStream } = recorder;
  useEffect(() => {
    const el = preview.current;
    if (!el) return;
    if (previewStream) {
      el.srcObject = previewStream;
      el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [previewStream]);
  const shape = tall ? "aspect-[4/5]" : "aspect-video";
  if (state.status === "stopped") {
    return <CoachVideo src={state.url} className={cn("w-full", shape)} />;
  }
  if (state.status === "recording") {
    return (
      <div data-coach-video-box="recording" className={cn(BOX, shape)}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={preview} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 font-mono text-[13px] font-semibold text-white">
          <i aria-hidden="true" className="block h-2.5 w-2.5 animate-pulse rounded-full bg-record" />
          {clock(state.elapsedSec)}
        </span>
        <span className="relative">{COPY.recording}</span>
      </div>
    );
  }
  return (
    <div data-coach-video-box="idle" className={cn(BOX, shape)}>
      <span>{COPY.camera}</span>
      {state.status === "error" ? (
        <p role="alert" className="absolute inset-x-4 bottom-3 m-0 text-center text-[13px] text-white">{state.message}</p>
      ) : null}
    </div>
  );
}
