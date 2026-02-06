"use client";

import { cn } from "@/lib/utils";
import type { ChunkConnectionStatus } from "@/hooks/useChunkMetrics";

export interface AmbientGlowCircleProps {
  glowColor: string;
  connectionStatus: ChunkConnectionStatus;
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
  className,
  size = 120,
}: AmbientGlowCircleProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
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
