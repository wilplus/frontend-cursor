"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** THE COACH'S VIDEO, PLAY ICON ONLY (Ideal Text Final Screens L2 and L8:
 *  "Coach video: no label, the play icon only"). A dark box with one round
 *  play button over it and the length in the corner; a tap plays, a tap on
 *  the picture pauses. No native controls, which drew a scrubber, a volume
 *  and a menu the design does not have. Used by step 0 (the coach's message
 *  for the Take) and by the Exercise step (the coach's video for the moment).
 *
 *  Nothing is fetched here: the file is the one already on the payload. */
export default function CoachVideo({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  function toggle() {
    const video = ref.current;
    if (!video) return;
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
        src={src}
        playsInline
        preload="metadata"
        className="aspect-video w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onClick={toggle}
      />
      {playing ? null : (
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
