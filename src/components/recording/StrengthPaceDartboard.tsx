"use client";

/**
 * Real-time Strength + Pace dartboard: center = good, edges = bad.
 * Ball position from error (1 - score) and direction (quiet/loud, slow/fast).
 * Ball glides via requestAnimationFrame lerp; color reflects distance (green = good, red = bad).
 * Realtime feedback only; final score is computed after upload.
 */
import { useMemo, useRef, useState, useEffect } from "react";

const DEFAULT_SIZE = 300;
const RADIUS = 120;
const BALL_R = 12;
/** Lerp factor per frame: lower = slower, calmer glide (sense of heading in the right direction). */
const BALL_LERP = 0.06;
export interface StrengthPaceDartboardProps {
  /** Smoothed 0..1 (1 = on target). */
  strengthScore: number;
  /** Smoothed 0..1 (1 = on target). */
  paceScore: number;
  /** -1 = quiet, 1 = loud. */
  strengthDirection: number;
  /** -1 = slow, 1 = fast. */
  paceDirection: number;
  size?: number;
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
  size = DEFAULT_SIZE,
}: StrengthPaceDartboardProps) {
  const scale = size / DEFAULT_SIZE;
  const center = size / 2;
  const radius = RADIUS * scale;
  const ballR = BALL_R * scale;

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

  const labelClass = "shrink-0 text-center text-foreground font-medium opacity-70";

  return (
    <div className="flex flex-col items-center gap-1" role="img" aria-label="Strength and pace wheel: center is on target">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      {/* All labels same font size (text-base); wheel 35% bigger (405px); container widened to fit */}
      <div className="relative flex w-full max-w-[min(560px,calc(100vw-2rem))] items-center justify-center gap-0 text-base">
        <span className={`w-16 ${labelClass}`} aria-hidden>Quiet</span>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="aspect-square w-full max-w-[405px] text-foreground"
          aria-hidden
        >
          <defs>
            <linearGradient id="dartboard-center" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.2)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.05)" />
            </linearGradient>
          </defs>
          {/* Rings: outer = bad, center = good */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.3} />
          <circle cx={center} cy={center} r={radius * 0.66} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.4} />
          <circle cx={center} cy={center} r={radius * 0.33} fill="url(#dartboard-center)" stroke="currentColor" strokeWidth={1} opacity={0.6} />
          {/* Axis labels: 1em = same size as Quiet/Loud */}
          <text x={center} y={center + radius + 22} textAnchor="middle" fontSize="1em" fill="currentColor" fontWeight={500} opacity={0.7}>Slow</text>
          <text x={center} y={center - radius - 14} textAnchor="middle" fontSize="1em" fill="currentColor" fontWeight={500} opacity={0.7}>Fast</text>
          {/* Ball: color by distance (center = primary, edge = destructive) */}
          <circle
            cx={cx}
            cy={cy}
            r={ballR}
            fill={dist < 0.5 ? "hsl(var(--primary))" : dist < 0.8 ? "hsl(var(--primary) / 0.85)" : "hsl(var(--destructive))"}
            stroke="hsl(var(--background))"
            strokeWidth={2}
            className="transition-none"
          />
        </svg>
        <span className={`w-16 ${labelClass}`} aria-hidden>Loud</span>
      </div>
    </div>
  );
}
