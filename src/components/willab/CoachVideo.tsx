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
  const { src, errored, recovering, handleError, handleLoaded } = useRecoverableSrc(rawSrc, onError);

  // A new link is a new file: not playing, its length unknown until read.
  useEffect(() => {
    setPlaying(false);
    setDuration(null);
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
      className={cn("relative overflow-hidden rounded-2xl bg-foreground/90", className)}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={src ?? undefined}
        playsInline
        preload="metadata"
        className="aspect-video w-full"
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

/** m:ss — the length, never a score. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
