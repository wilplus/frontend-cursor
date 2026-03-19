"use client";

/**
 * Post-session Review Summary.
 * Shows performance score + a simple label.
 */

import type { LiveCoachSnapshot } from "@/lib/sniper/types";

const SCORE_LABEL = (s: number) => {
  if (s >= 75) return "Great flow";
  if (s >= 50) return "Good — keep refining";
  return "Needs practice";
};

const SCORE_COLOR = (s: number) => {
  if (s >= 75) return "#2E9E6F";
  if (s >= 50) return "#D6A23D";
  return "#C94F4F";
};

export interface SniperReviewSummaryProps {
  snapshot: LiveCoachSnapshot;
  className?: string;
}

export function SniperReviewSummary({ snapshot, className = "" }: SniperReviewSummaryProps) {
  const score = Math.round(snapshot.performanceScore);
  const color = SCORE_COLOR(score);
  const label = SCORE_LABEL(score);
  const pausePct = Math.round(snapshot.pauseRatio * 100);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="flex flex-col items-center">
        <p className="text-4xl font-semibold tabular-nums" style={{ color }}>
          {score}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>

      <div className="text-sm text-muted-foreground text-center space-y-0.5">
        <p>Pause ratio: {pausePct}%</p>
        {snapshot.voicedDurationSec > 0 && (
          <p>Speaking time: {Math.round(snapshot.voicedDurationSec)}s</p>
        )}
      </div>
    </div>
  );
}
