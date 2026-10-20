"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { claimPlayback, releasePlayback } from "@/lib/media/exclusivePlayback";
import { useRecoverableSrc } from "@/lib/media/mediaRefresh";

/** THE COACH'S VIDEO, PLAY ICON ONLY (Ideal Text Final Screens L2 and L8:
 *  "Coach video: no label, the play icon only"). A dark box with one round
 *  play button over it and the length in the corner; a tap plays, a tap on
 *  the picture pauses. No native controls, which drew a scrubber, a volume
 *  and a menu the design does not have. Used by step 0 (the coach's message
 *  for the Take) and by the Exercise step (the coach's video for the moment).
 *
 *  The box follows the video's orientation (founder, 2026-10-16, "Bubble
 *  coach video display adapts to video orientation"): until the metadata
 *  arrives it is the 16:9 box; a horizontal video then takes the bubble's
 *  width at its own ratio, a vertical one stands tall, capped at about
 *  sixty percent of the screen, as wide as that makes it, on the left. No
 *  black bars either way. A caller that names an aspect in `className`
 *  (the Exercise's 4:5 frame, the coach panel's boxes) has chosen the frame,
 *  and the video keeps to it.
 *
 *  Nothing is fetched here: the file is the one already on the payload. A
 *  link that fails (expired, 404) asks the host's MediaRefreshProvider once
 *  for a fresh one; if that does not help the play button goes, so a dead
 *  video never offers a tap that does nothing (no text is added). */
export default function CoachVideo({
  src: rawSrc,
  className,
  onError,
}: {
  src: string;
  className?: string;
  /** Told when the <video> errors, for a host that manages its own link. */
  onError?: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  // Width over height of the picture itself, read from its metadata.
  const [ratio, setRatio] = useState<number | null>(null);
  const { src, errored, recovering, handleError, handleLoaded } = useRecoverableSrc(rawSrc, onError);
  const framed = hasFrame(className);
  const orientation = ratio === null ? null : ratio < 1 ? "portrait" : "landscape";
  const adapts = !framed && ratio !== null;

  // A new link is a new file: not playing, its length and shape unknown
  // until read.
  useEffect(() => {
    setPlaying(false);
    setDuration(null);
    setRatio(null);
  }, [src]);

  useEffect(() => {
    const video = ref.current;
    return () => releasePlayback(video);
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video || errored || recovering) return;
    if (video.paused) {
      const started = video.play();
      // jsdom returns undefined; browsers return a promise that rejects
      // when autoplay policy refuses. Either way the overlay follows the
      // element's own play/pause events, never this call.
      if (started && typeof started.catch === "function") started.catch(() => undefined);
    } else {
      video.pause();
    }
  }

  return (
    <div
      data-coach-video
      data-orientation={orientation ?? undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-foreground/90",
        className,
        // A tall video's box is only as wide as the video: no dark bars
        // beside it, and it sits at the bubble's left.
        adapts && orientation === "portrait" && "w-fit max-w-full self-start",
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={src ?? undefined}
        playsInline
        preload="metadata"
        className={cn(
          "aspect-video w-full",
          adapts && orientation === "portrait" && "h-[min(60vh,480px)] w-auto max-w-full",
        )}
        style={adapts && ratio ? { aspectRatio: String(ratio) } : undefined}
        onPlay={(event) => {
          claimPlayback(event.currentTarget);
          setPlaying(true);
        }}
        onPause={(event) => {
          releasePlayback(event.currentTarget);
          setPlaying(false);
        }}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          handleLoaded();
          setDuration(event.currentTarget.duration);
          setRatio(ratioOf(event.currentTarget));
        }}
        onError={() => {
          setPlaying(false);
          handleError();
        }}
        onClick={toggle}
      />
      {playing || errored || recovering ? null : (
        <button
          type="button"
          aria-label="Play"
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md">
            <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
          </span>
        </button>
      )}
      {duration !== null && Number.isFinite(duration) && duration > 0 ? (
        <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] font-medium text-background tabular-nums">
          {clock(duration)}
        </span>
      ) : null}
    </div>
  );
}

/** The caller named the box's shape (an `aspect-…` class on the box or on
 *  its video): that frame is a design, and the video keeps to it. */
function hasFrame(className: string | undefined): boolean {
  return /\baspect-/.test(className ?? "");
}

/** Width over height of the picture; null until the metadata says. */
function ratioOf(video: HTMLVideoElement): number | null {
  const { videoWidth: w, videoHeight: h } = video;
  return w > 0 && h > 0 ? w / h : null;
}

/** m:ss — the length, never a score. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
