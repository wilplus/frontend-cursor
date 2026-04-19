"use client";

import { useState, useRef } from "react";
import { Play, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step0AssignmentCardProps {
  videoUrl: string | null;
  introText: string | null;
  /** When true, this is the generic "welcome video" fallback (no coach assignment yet).
   *  Render a welcome label and hide the Start Your Practice CTA. */
  isUniversalWelcome?: boolean;
  loading: boolean;
  error: string | null;
  onStart: () => void;
}

export default function Step0AssignmentCard({
  videoUrl,
  introText,
  isUniversalWelcome = false,
  loading,
  error,
  onStart,
}: Step0AssignmentCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const heading = isUniversalWelcome ? "Welcome from your coach" : null;
  const waitingCopy = isUniversalWelcome
    ? "Waiting for your coach to send your first assignment."
    : null;

  const handleVideoClick = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      v.requestFullscreen().catch(() => {});
    }
  };

  return (
    <>
      {heading ? (
        <p className="w-full text-center text-sm font-medium text-muted-foreground">
          {heading}
        </p>
      ) : null}

      <div className="w-full">
        {videoUrl ? (
          <div
            onClick={handleVideoClick}
            className="relative flex aspect-[9/16] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-muted"
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full rounded-lg object-cover"
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Centre play button — hidden once playing */}
            {!isPlaying ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
                  <Play className="h-7 w-7 ml-1" fill="currentColor" />
                </span>
              </span>
            ) : null}

            {/* Fullscreen button — bottom-right corner */}
            <button
              type="button"
              onClick={handleFullscreen}
              aria-label="Toggle fullscreen"
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white transition-opacity hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">No video</p>
          </div>
        )}
      </div>

      {introText && introText.trim() ? (
        <p className="w-full text-sm text-muted-foreground whitespace-pre-line">
          {introText.trim()}
        </p>
      ) : null}

      {isUniversalWelcome ? (
        <p className="w-full text-center text-sm text-muted-foreground">
          {waitingCopy}
        </p>
      ) : (
        <Button
          onClick={onStart}
          disabled={loading}
          className="w-full max-w-[280px] rounded-xl h-12 bg-primary text-white font-semibold hover:bg-primary/90"
        >
          {error ? "Try again" : loading ? "Starting…" : "Start Your Practice"}
        </Button>
      )}
    </>
  );
}
