/**
 * Sniper Wheel — Coaching cue logic.
 * Single primary cue; structural over micro; actionable tone.
 * Only show when drift >10% tolerance and sustained (caller manages sustain).
 */

import type { SniperMetricState, SniperScores, Zone } from "./types";
import {
  PACE_IDEAL_WPM,
  PACE_TOLERANCE_WPM,
  PACE_GREEN_LO,
  PACE_GREEN_HI,
  PAUSE_IDEAL_MS,
  PAUSE_GREEN_LO,
  PAUSE_GREEN_HI,
  PAUSE_YELLOW_LO,
  PAUSE_YELLOW_HI,
  DYNAMIC_IDEAL_DB,
  DYNAMIC_GREEN_LO,
  DYNAMIC_GREEN_HI,
  EMPHASIS_IDEAL_PER_MIN,
  EMPHASIS_GREEN_LO,
  EMPHASIS_GREEN_HI,
} from "./constants";

/** Returns zone for a value given green and optional yellow bounds. */
function getZone(
  value: number,
  greenLo: number,
  greenHi: number,
  yellowLo: number,
  yellowHi: number
): Zone {
  if (value >= greenLo && value <= greenHi) return "green";
  if (value >= yellowLo && value <= yellowHi) return "yellow";
  return "red";
}

/** Drift beyond 10% of tolerance from ideal (e.g. for pace: 10% of 8 ≈ 0.8 WPM). */
function isDriftSignificant(
  value: number,
  ideal: number,
  tolerance: number,
  pct = 0.1
): boolean {
  return Math.abs(value - ideal) > tolerance * pct;
}

export type CoachingResult = {
  cue: string;
  segment: keyof SniperScores | null;
};

/**
 * Returns the single primary coaching cue.
 * Priority: energy (structural) > pause > pace > dynamic > emphasis.
 * Tone: actionable, calm, e.g. "Slow by 6 WPM for stronger authority."
 * Returns empty cue when all in green or no significant drift.
 */
export function getPrimaryCoachingCue(
  metrics: SniperMetricState,
  scores: SniperScores
): CoachingResult {
  const e = metrics.energyByThird;
  const sessionLongEnough = metrics.sessionDurationSec >= 120;

  // 1) Structural: energy decline (highest priority)
  if (sessionLongEnough && e && e.e3 < e.e2) {
    const declinePct = ((e.e2 - e.e3) / (e.e2 + 1e-8)) * 100;
    if (declinePct > 10) {
      return {
        cue: "Rebuild intensity in the final third. Energy tapering.",
        segment: "energy",
      };
    }
  }

  // 2) Pause
  const pauseZone = getZone(
    metrics.avgPauseMs,
    PAUSE_GREEN_LO,
    PAUSE_GREEN_HI,
    PAUSE_YELLOW_LO,
    PAUSE_YELLOW_HI
  );
  if (
    pauseZone !== "green" &&
    metrics.confidence.pause !== "insufficient" &&
    isDriftSignificant(metrics.avgPauseMs, PAUSE_IDEAL_MS, 70, 0.1)
  ) {
    if (metrics.avgPauseMs < PAUSE_GREEN_LO) {
      return {
        cue: "Extend sentence-end pauses by ~200 ms. Let ideas land.",
        segment: "pause",
      };
    }
    return {
      cue: "Shorten pauses slightly for better flow.",
      segment: "pause",
    };
  }

  // 3) Pace
  const paceZone = getZone(
    metrics.paceWpm,
    PACE_GREEN_LO,
    PACE_GREEN_HI,
    130,
    165
  );
  if (
    paceZone !== "green" &&
    metrics.confidence.pace !== "insufficient" &&
    isDriftSignificant(metrics.paceWpm, PACE_IDEAL_WPM, PACE_TOLERANCE_WPM, 0.1)
  ) {
    const d = Math.round(metrics.paceWpm - PACE_IDEAL_WPM);
    if (d > 0) {
      return {
        cue: `Slow by ${Math.min(15, d)} WPM for stronger authority.`,
        segment: "pace",
      };
    }
    return {
      cue: "Increase pace slightly so delivery stays engaging.",
      segment: "pace",
    };
  }

  // 4) Dynamic
  const dynZone = getZone(
    metrics.dynamicRangeDb,
    DYNAMIC_GREEN_LO,
    DYNAMIC_GREEN_HI,
    9,
    18
  );
  if (
    dynZone !== "green" &&
    metrics.confidence.dynamic !== "insufficient" &&
    isDriftSignificant(metrics.dynamicRangeDb, DYNAMIC_IDEAL_DB, 2)
  ) {
    if (metrics.dynamicRangeDb < DYNAMIC_GREEN_LO) {
      return {
        cue: "Vary volume more. Add contrast on key phrases.",
        segment: "dynamic",
      };
    }
    return {
      cue: "Smooth out volume swings for a more controlled delivery.",
      segment: "dynamic",
    };
  }

  // 5) Emphasis
  const emphZone = getZone(
    metrics.emphasisPerMin,
    EMPHASIS_GREEN_LO,
    EMPHASIS_GREEN_HI,
    15,
    60
  );
  if (
    emphZone !== "green" &&
    metrics.confidence.emphasis !== "insufficient" &&
    isDriftSignificant(metrics.emphasisPerMin, EMPHASIS_IDEAL_PER_MIN, 8)
  ) {
    if (metrics.emphasisPerMin < EMPHASIS_GREEN_LO) {
      return {
        cue: "Stress key words more. Add emphasis on important phrases.",
        segment: "emphasis",
      };
    }
    return {
      cue: "Ease off on emphasis. Not every phrase needs a spike.",
      segment: "emphasis",
    };
  }

  return { cue: "", segment: null };
}
