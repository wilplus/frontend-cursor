"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ChunkConnectionStatus } from "@/hooks/useChunkMetrics";

const PAUSE_DOT_DURATION_MS = 450;

export interface AmbientGlowCircleProps {
  glowColor: string;
  connectionStatus: ChunkConnectionStatus;
  /** When set (timestamp ms), a red dot is shown on the circle for a short time. */
  lastPauseDetectedAt?: number;
  className?: string;
  size?: number;
}

const STATUS_LABELS: Record<ChunkConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  delayed: "Slow connection",
  error: "Connection issue",
};

export function AmbientGlowCircle({
  glowColor,
  connectionStatus,
  lastPauseDetectedAt = 0,
  className,
  size = 120,
}: AmbientGlowCircleProps) {
  const [showPauseDot, setShowPauseDot] = useState(false);

  useEffect(() => {
    if (lastPauseDetectedAt <= 0) return;
    setShowPauseDot(true);
    const t = setTimeout(() => setShowPauseDot(false), PAUSE_DOT_DURATION_MS);
    return () => clearTimeout(t);
  }, [lastPauseDetectedAt]);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative inline-block">
        <div
          className="rounded-full transition-colors duration-300 ease-out"
          style={{
            width: size,
            height: size,
            backgroundColor: glowColor,
            boxShadow: `0 0 ${Math.round(size * 0.6)}px ${glowColor}`,
          }}
          aria-hidden
        />
        {showPauseDot && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <div
              className="rounded-full bg-red-500 shadow-md animate-fade-in"
              style={{ width: size * 0.2, height: size * 0.2, minWidth: 14, minHeight: 14 }}
            />
          </div>
        )}
      </div>
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            connectionStatus === "live" && "bg-green-500",
            connectionStatus === "connecting" && "bg-amber-500 animate-pulse",
            connectionStatus === "delayed" && "bg-amber-500",
            connectionStatus === "error" && "bg-destructive"
          )}
        />
        <span>{STATUS_LABELS[connectionStatus]}</span>
      </div>
    </div>
  );
}
