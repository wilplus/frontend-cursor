"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 5 · Video (founder 2026-09-30, A5; build plan P2-11).                */
/*                                                                            */
/*  Recorded in the panel with the coach video recorder that already exists   */
/*  (camera and microphone, under a minute). The default for an error, where  */
/*  the primary is Record and "Skip the video" is the way out; optional for    */
/*  the rest, where the primary is Next and "Add a video" opens the camera.   */
/*  After Stop: the preview, then Keep or Record again. "Upload instead" is    */
/*  the way in for a clip filmed elsewhere, and the only way where the        */
/*  browser cannot record.                                                     */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import {
  isCoachVideoRecordingSupported, MAX_UPLOAD_BYTES, useCoachVideoRecorder,
} from "@/hooks/useCoachVideoRecorder";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

export interface KeptVideo {
  file: File;
  /** A local preview address for the kept clip. */
  url: string;
}

function tooBig(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

export default function CoachVideoSheet({
  pager,
  videoDefault,
  kept,
  onKeep,
  onDiscard,
  onClose,
  onNext,
}: {
  pager: Pager;
  videoDefault: boolean;
  /** The clip the coach kept on this walk, if any. */
  kept: KeptVideo | null;
  onKeep: (video: KeptVideo) => void;
  onDiscard: () => void;
  onClose: () => void;
  onNext: () => void;
}) {
  const rec = useCoachVideoRecorder();
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [wantsVideo, setWantsVideo] = useState(videoDefault);
  const supported = isCoachVideoRecordingSupported();

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (rec.previewStream) {
      el.srcObject = rec.previewStream;
      el.play().catch(() => { /* first frame still shows */ });
    } else {
      el.srcObject = null;
    }
  }, [rec.previewStream]);

  const { state } = rec;
  const oversized = state.status === "stopped" && tooBig(state.file);

  function keepRecorded(): void {
    if (state.status !== "stopped" || oversized) return;
    onKeep({ file: state.file, url: state.url });
    rec.reset();
  }

  function fromFile(file: File | null): void {
    if (!file) return;
    onKeep({ file, url: URL.createObjectURL(file) });
  }

  const eyebrow = videoDefault ? COPY.videoEyebrowError : COPY.videoEyebrowOptional;
  const upload = (
    <input
      ref={fileRef}
      type="file"
      accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
      className="hidden"
      data-testid="coach-video-file"
      onChange={(e) => fromFile(e.target.files?.[0] ?? null)}
    />
  );

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (kept) {
    body = (
      <>
        <video src={kept.url} controls playsInline className="w-full rounded-xl bg-foreground" data-testid="coach-video-kept" />
      </>
    );
    footer = (
      <div className="flex flex-col gap-0.5">
        <button type="button" className={PILL} onClick={onNext}>{COPY.pillNextNoVideo}</button>
        <button type="button" className={LINK} onClick={() => { onDiscard(); setWantsVideo(true); }}>
          {COPY.linkRecordAgain}
        </button>
      </div>
    );
  } else if (state.status === "recording") {
    body = (
      <>
        <video ref={previewRef} muted playsInline className="aspect-video w-full rounded-xl bg-foreground" />
        <p className="text-center text-[13px] text-muted-foreground">{state.elapsedSec}s</p>
      </>
    );
    footer = (
      <button type="button" className={PILL} onClick={() => void rec.stop()}>Stop</button>
    );
  } else if (state.status === "stopped") {
    body = (
      <>
        <video src={state.url} controls playsInline className="w-full rounded-xl bg-foreground" />
        {oversized ? (
          <p role="alert" className="text-[13px] text-destructive">
            The clip is too large to send; record a shorter one.
          </p>
        ) : null}
      </>
    );
    footer = (
      <div className="flex flex-col gap-0.5">
        <button type="button" className={PILL} disabled={oversized} onClick={keepRecorded}>{COPY.pillKeep}</button>
        <button type="button" className={LINK} onClick={() => rec.reset()}>{COPY.linkRecordAgain}</button>
      </div>
    );
  } else {
    const showCamera = wantsVideo && supported;
    body = (
      <>
        {state.status === "error" ? (
          <p role="alert" className="text-[13px] text-destructive">{state.message}</p>
        ) : null}
        {showCamera ? (
          <>
            <div className="mx-auto mt-2 flex h-32 w-32 items-center justify-center rounded-full bg-destructive/10">
              <span className="block h-10 w-10 rounded-lg bg-destructive" aria-hidden />
            </div>
            <p className="text-center text-[13px] text-muted-foreground">{COPY.videoHint}</p>
          </>
        ) : wantsVideo ? (
          <p className="text-center text-[13px] text-muted-foreground">{COPY.videoUnsupported}</p>
        ) : null}
      </>
    );
    footer = (
      <div className="flex flex-col gap-0.5">
        {showCamera ? (
          <button type="button" className={PILL} onClick={() => void rec.start()} data-testid="coach-video-record">
            <span className="block h-2 w-2 rounded-full bg-destructive" aria-hidden />
            {COPY.pillRecord}
          </button>
        ) : (
          <button type="button" className={PILL} onClick={onNext}>{COPY.pillNextNoVideo}</button>
        )}
        {showCamera ? (
          <button type="button" className={LINK} onClick={() => fileRef.current?.click()}>{COPY.linkUploadInstead}</button>
        ) : wantsVideo ? (
          <button type="button" className={LINK} onClick={() => fileRef.current?.click()}>{COPY.linkUploadInstead}</button>
        ) : (
          <button type="button" className={LINK} onClick={() => (supported ? setWantsVideo(true) : fileRef.current?.click())}>
            {COPY.linkAddVideo}
          </button>
        )}
        {showCamera && videoDefault ? (
          <button type="button" className={LINK} onClick={onNext}>{COPY.linkSkipVideo}</button>
        ) : null}
      </div>
    );
  }

  return (
    <SheetFrame
      title={COPY.videoTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
      footer={footer}
    >
      <div className="flex flex-col gap-4" data-testid="coach-video-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</span>
        {body}
        {upload}
      </div>
    </SheetFrame>
  );
}
