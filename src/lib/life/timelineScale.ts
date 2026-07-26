/* -------------------------------------------------------------------------- */
/*  life/timelineScale — the zoom-tier maths for the 60-year timeline (FE-8)   */
/*                                                                            */
/*  Sixty years is 240 quarters. They cannot all render at once: at a          */
/*  full-width 1200px canvas that is five pixels per quarter, so the tick      */
/*  labels would overlap into a grey smear. The tier therefore switches with   */
/*  scale rather than being a user setting.                                    */
/*                                                                            */
/*  Pure and separately testable on purpose: the canvas component is untestable*/
/*  in a node environment, so the arithmetic lives out here where it is not.   */
/* -------------------------------------------------------------------------- */

import type { LifeTimelineTier } from "./types";

export const MS_PER_DAY = 86_400_000;

/** Thresholds in pixels-per-day. Chosen so a tick label has at least ~45px:
 *  a quarter is ~91 days, a year ~365, a decade ~3653. */
const QUARTER_MIN_PX_PER_DAY = 45 / 91;
const YEAR_MIN_PX_PER_DAY = 45 / 365;

export function tierForScale(pxPerDay: number): LifeTimelineTier {
  if (pxPerDay >= QUARTER_MIN_PX_PER_DAY) return "quarter";
  if (pxPerDay >= YEAR_MIN_PX_PER_DAY) return "year";
  return "decade";
}

/** Zoom bounds: fully zoomed out shows about 60 years across a 1200px canvas,
 *  fully zoomed in shows about a month. */
export const MIN_PX_PER_DAY = 1200 / (60 * 365);
export const MAX_PX_PER_DAY = 1200 / 30;

export function clampScale(pxPerDay: number): number {
  return Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, pxPerDay));
}

/** Tick positions for the current tier, as epoch ms, covering [from, to]. */
export function ticksFor(
  tier: LifeTimelineTier,
  fromMs: number,
  toMs: number
): number[] {
  const out: number[] = [];
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return out;
  }
  const start = new Date(fromMs);
  let year = start.getUTCFullYear();
  let month = 0;

  if (tier === "quarter") {
    month = Math.floor(start.getUTCMonth() / 3) * 3;
  } else if (tier === "decade") {
    year = Math.floor(year / 10) * 10;
  }

  // Hard cap: a runaway loop on a bad scale would lock the tab, and 4000 ticks
  // is already far more than any canvas width can show.
  for (let guard = 0; guard < 4000; guard += 1) {
    const t = Date.UTC(year, month, 1);
    if (t > toMs) break;
    if (t >= fromMs) out.push(t);
    if (tier === "quarter") {
      month += 3;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    } else if (tier === "year") {
      year += 1;
    } else {
      year += 10;
    }
  }
  return out;
}

export function tickLabel(tier: LifeTimelineTier, ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  if (tier === "quarter") {
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `Q${q} ${String(year).slice(2)}`;
  }
  if (tier === "year") return String(year);
  return `${year}s`;
}

/** The visible window for a canvas of `width` px centred on `centerMs`. */
export function windowFor(
  centerMs: number,
  pxPerDay: number,
  width: number
): { fromMs: number; toMs: number } {
  const halfDays = width / 2 / pxPerDay;
  const half = halfDays * MS_PER_DAY;
  return { fromMs: centerMs - half, toMs: centerMs + half };
}

export function timeToX(
  ms: number,
  centerMs: number,
  pxPerDay: number,
  width: number
): number {
  return width / 2 + ((ms - centerMs) / MS_PER_DAY) * pxPerDay;
}

export function xToTime(
  x: number,
  centerMs: number,
  pxPerDay: number,
  width: number
): number {
  return centerMs + ((x - width / 2) / pxPerDay) * MS_PER_DAY;
}
