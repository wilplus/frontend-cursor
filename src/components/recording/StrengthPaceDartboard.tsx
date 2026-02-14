"use client";

/**
 * Real-time Strength + Pace dartboard: center = good, edges = bad.
 * Ball position from error (1 - score) and direction (quiet/loud, slow/fast).
 * Ball glides via requestAnimationFrame lerp; color reflects distance (green = good, red = bad).
 * Realtime feedback only; final score is computed after upload.
 */
import { useMemo, useRef, useState, useEffect } from "react";

const VIEWBOX_SIZE = 300;
const RADIUS = 120;
const BALL_R = 10;
const LABEL_OFFSET = 22; // labels at radius + 22 from center in viewBox units
/** Lerp factor per frame: lower = slower, calmer glide (sense of heading in the right direction). */
const BALL_LERP = 0.06;
const LABEL_FONT_SIZE = 13;
const SCORE_FONT_SIZE = 9;
export interface StrengthPaceDartboardProps {
  /** Smoothed 0..1 (1 = on target). */
  strengthScore: number;
  /** Smoothed 0..1 (1 = on target). */
  paceScore: number;
  /** -1 = quiet, 1 = loud. */
  strengthDirection: number;
  /** -1 = slow, 1 = fast. */
  paceDirection: number;
}

/** Center = good; position = direction * (1 - score), clamped to [-1, 1]. */
function ballPosition(
  score: number,
  direction: number
): number {
  const error = 1 - score;
  const signed = direction * error;
  return Math.max(-1, Math.min(1, signed));
}

/** Distance from center in [-1,1] space; 0 = center, 1 = edge. */
function distanceFromCenter(nx: number, ny: number): number {
  return Math.min(1, Math.sqrt(nx * nx + ny * ny));
}

/** Human-readable status for accessibility (live region). */
function getBallStatus(
  strengthScore: number,
  paceScore: number,
  strengthDirection: number,
  paceDirection: number
): string {
  const nearCenter = strengthScore > 0.85 && paceScore > 0.85;
  if (nearCenter) return "Strength and pace on target.";
  const parts: string[] = [];
  if (strengthScore <= 0.85) {
    parts.push(strengthDirection < 0 ? "Too quiet" : "Too loud");
  }
  if (paceScore <= 0.85) {
    parts.push(paceDirection < 0 ? "Slow" : "Fast");
  }
  return parts.length ? parts.join(", ") + "." : "Strength and pace on target.";
}

export function StrengthPaceDartboard({
  strengthScore,
  paceScore,
  strengthDirection,
  paceDirection,
}: StrengthPaceDartboardProps) {
  const center = VIEWBOX_SIZE / 2;
  const radius = RADIUS;

  const targetX = useMemo(
    () => ballPosition(strengthScore, strengthDirection),
    [strengthScore, strengthDirection]
  );
  const targetY = useMemo(
    () => ballPosition(paceScore, paceDirection),
    [paceScore, paceDirection]
  );

  const targetRef = useRef({ x: targetX, y: targetY });
  targetRef.current = { x: targetX, y: targetY };
  const currentRef = useRef({ x: 0, y: 0 });
  const [displayPos, setDisplayPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * BALL_LERP;
      c.y += (t.y - c.y) * BALL_LERP;
      setDisplayPos({ x: c.x, y: c.y });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const cx = center + displayPos.x * radius;
  const cy = center - displayPos.y * radius; // SVG y down; we want fast = top = negative y
  const dist = distanceFromCenter(displayPos.x, displayPos.y);
  const statusText = getBallStatus(strengthScore, paceScore, strengthDirection, paceDirection);
  const labelFont = "system-ui, -apple-system, sans-serif";
  const scorePercent = (s: number) => Math.round(s * 100);

  return (
    <div className="flex flex-col items-center w-full" role="img" aria-label="Strength and pace wheel: center is on target">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      <svg
        viewBox="0 0 300 300"
        className="w-full aspect-square text-foreground"
        style={{ fontFamily: labelFont }}
        aria-hidden
      >
        <defs>
          <linearGradient id="dartboard-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.2)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.05)" />
          </linearGradient>
          <filter id="dartboard-ball-shadow" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
            <feDropShadow dx={0} dy={2} stdDeviation={0} floodColor="hsl(var(--foreground) / 0.25)" />
          </filter>
        </defs>
        {/* Rings: 1px stroke, HSL tokens */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="hsl(var(--dartboard-ring-outer))" strokeWidth={1} />
        <circle cx={center} cy={center} r={radius * 0.66} fill="none" stroke="hsl(var(--dartboard-ring-mid))" strokeWidth={1} />
        <circle cx={center} cy={center} r={radius * 0.33} fill="url(#dartboard-center)" stroke="hsl(var(--dartboard-ring-inner))" strokeWidth={1} />
        {/* Axis labels: radius + 22 from center, 13px, font-weight 500, fill=foreground */}
        <text x={center - radius - LABEL_OFFSET} y={center} textAnchor="middle" fontSize={LABEL_FONT_SIZE} fontWeight={500} fill="currentColor">Quiet</text>
        <text x={center + radius + LABEL_OFFSET} y={center} textAnchor="middle" fontSize={LABEL_FONT_SIZE} fontWeight={500} fill="currentColor">Loud</text>
        <text x={center} y={center - radius - LABEL_OFFSET} textAnchor="middle" fontSize={LABEL_FONT_SIZE} fontWeight={500} fill="currentColor">Fast</text>
        <text x={center} y={center + radius + LABEL_OFFSET} textAnchor="middle" fontSize={LABEL_FONT_SIZE} fontWeight={500} fill="currentColor">Slow</text>
        {/* Ball: r=10, 2px shadow below */}
        <circle
          cx={cx}
          cy={cy}
          r={BALL_R}
          fill={dist < 0.5 ? "hsl(var(--primary))" : dist < 0.8 ? "hsl(var(--primary) / 0.85)" : "hsl(var(--destructive))"}
          stroke="hsl(var(--background))"
          strokeWidth={2}
          filter="url(#dartboard-ball-shadow)"
          className="transition-none"
        />
      </svg>
      {/* Score sub-label: 9px, font-weight 500, opacity 0.7, no monospace */}
      <p className="text-foreground font-medium opacity-70 mt-1" style={{ fontSize: SCORE_FONT_SIZE, fontFamily: labelFont }}>
        Strength {scorePercent(strengthScore)}% · Pace {scorePercent(paceScore)}%
      </p>
    </div>
  );
}
