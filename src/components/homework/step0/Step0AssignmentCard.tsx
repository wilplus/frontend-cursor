"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step0AssignmentCardProps {
  videoUrl: string | null;
  introText: string | null;
  loading: boolean;
  error: string | null;
  onStart: () => void;
  onOpenVideoModal: (url: string) => void;
}

export default function Step0AssignmentCard({
  videoUrl,
  introText: _introText,
  loading,
  error,
  onStart,
  onOpenVideoModal,
}: Step0AssignmentCardProps) {
  // introText is available for future use (e.g. display below the video)
  void _introText;
  return (
    <>
      <div className="w-full">
        {videoUrl ? (
          <button
            type="button"
            onClick={() => onOpenVideoModal(videoUrl)}
            className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-lg bg-muted transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <video
              src={videoUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
                <Play className="h-7 w-7 ml-1" fill="currentColor" />
              </span>
            </span>
          </button>
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">No video</p>
          </div>
        )}
      </div>

      <Button
        onClick={onStart}
        disabled={loading}
        className="w-full max-w-[280px] rounded-xl h-12 bg-primary text-white font-semibold hover:bg-primary/90"
      >
        {error ? "Try again" : loading ? "Starting…" : "Start Your Practice"}
      </Button>
    </>
  );
}
