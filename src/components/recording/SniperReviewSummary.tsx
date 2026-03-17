"use client";

/**
 * Lightweight Review Snapshot after a Sniper (voice alignment) session.
 * Session Summary: Voice Alignment % (blended when adaptive), Progress (early users), Strongest Area, Needs Work, Fatigue.
 */

import type {
  SniperSessionSnapshot,
  SniperScores,
  SniperTier,
  UserSniperProfile,
  SniperGrowthResult,
} from "@/lib/sniper/types";
import { computeAdaptiveResult } from "@/lib/sniper/adaptive";
import { getTierFromScore } from "@/lib/sniper/scoring";

const TIER_LABELS: Record<SniperTier, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

const SEGMENT_LABELS: Record<keyof SniperScores, string> = {
  pace: "Pace Control",
  pause: "Pause Discipline",
  dynamic: "Dynamic Strength",
  emphasis: "Emphasis Precision",
  energy: "Energy Structure",
  pitch: "Pitch Variety",
};

export interface SniperReviewSummaryProps {
  snapshot: SniperSessionSnapshot;
  /** When set and baseline ready, show blended score and Progress (early users). */
  profile?: UserSniperProfile | null;
  className?: string;
}

export function SniperReviewSummary({
  snapshot,
  profile = null,
  className = "",
}: SniperReviewSummaryProps) {
  const energyAvailable = snapshot.sessionMeans.energyRatio != null;
  const adaptive: SniperGrowthResult = computeAdaptiveResult(
    profile ?? null,
    snapshot.overallScore,
    snapshot.sessionMeans,
    energyAvailable
  );
  const displayScore = Math.round(adaptive.displayScore);
  const tier = getTierFromScore(displayScore);
  const showProgress = adaptive.baselineReady && adaptive.sessionCount < 5;
  const showLearningBaseline =
    profile != null && profile.session_count > 0 && !adaptive.baselineReady;

  return (
    <div
      className={`rounded-xl border border-border bg-muted/30 p-4 space-y-3 ${className}`}
      role="region"
      aria-label="Session summary"
    >
      <h3 className="text-sm font-semibold text-foreground">Session Summary</h3>
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">Voice Alignment</span>
          <span className="font-semibold tabular-nums">{displayScore}%</span>
        </div>
        {showProgress && (
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{Math.round(adaptive.growthScore)}%</span>
          </div>
        )}
        {showLearningBaseline && (
          <p className="text-xs text-muted-foreground">Learning your baseline…</p>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">Level</span>
          <span>{TIER_LABELS[tier]}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Strongest area: </span>
          <span className="font-medium">{SEGMENT_LABELS[snapshot.strongestSegment]}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Needs work: </span>
          <span className="font-medium">{SEGMENT_LABELS[snapshot.needsWorkSegment]}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">Fatigue detected</span>
          <span>{snapshot.fatigueDetected ? "Yes" : "No"}</span>
        </div>
      </div>
    </div>
  );
}
