"use client";

/**
 * Strength + Pace target: three concentric rings (light orange → dark orange center).
 * Red ball moves with real-time strength/pace; goal is to keep it in the center.
 */
import { useMemo, useRef, useState, useEffect } from "react";

const VIEWBOX_SIZE = 300;
const RADIUS = 120;
const BALL_R = 10;
/** Base blend (0–1); double smoothstep yields slower, eased motion with no sudden jumps. */
const BALL_LERP_BASE = 0.2;
/** Smoothstep for easing (applied x2 for extra smooth direction changes). */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
function easedLerp(): number {
  return smoothstep(smoothstep(BALL_LERP_BASE));
}

/** Position in [-1, 1] from score and direction (center = on target). */
function ballPosition(score: number, direction: number): number {
  const error = 1 - score;
  const signed = direction * error;
  return Math.max(-1, Math.min(1, signed));
}

function getBallStatus(
  strengthScore: number,
  paceScore: number,
  strengthDirection: number,
  paceDirection: number
): string {
  const nearCenter = strengthScore > 0.85 && paceScore > 0.85;
  if (nearCenter) return "Strength and pace on target.";
  const parts: string[] = [];
  if (strengthScore <= 0.85 && strengthDirection !== 0) parts.push(strengthDirection < 0 ? "Too quiet" : "Too loud");
  if (paceScore <= 0.85) parts.push(paceDirection < 0 ? "Slow" : "Fast");
  return parts.length ? parts.join(", ") + "." : "Strength and pace on target.";
}

export interface StrengthPaceDartboardProps {
  strengthScore: number;
  paceScore: number;
  strengthDirection: number;
  paceDirection: number;
}

export function StrengthPaceDartboard({
  strengthScore,
  paceScore,
  strengthDirection,
  paceDirection,
}: StrengthPaceDartboardProps) {
  const center = VIEWBOX_SIZE / 2;
  const radius = RADIUS;

  const targetX = useMemo(() => ballPosition(strengthScore, strengthDirection), [strengthScore, strengthDirection]);
  const targetY = useMemo(() => ballPosition(paceScore, paceDirection), [paceScore, paceDirection]);

  const targetRef = useRef({ x: targetX, y: targetY });
  targetRef.current = { x: targetX, y: targetY };
  const currentRef = useRef({ x: 0, y: 0 });
  const [displayPos, setDisplayPos] = useState({ x: 0, y: 0 });

  const ballBlend = useMemo(() => easedLerp(), []);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * ballBlend;
      c.y += (t.y - c.y) * ballBlend;
      setDisplayPos({ x: c.x, y: c.y });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [ballBlend]);

  const cx = center + displayPos.x * radius;
  const cy = center - displayPos.y * radius;
  const statusText = getBallStatus(strengthScore, paceScore, strengthDirection, paceDirection);

  return (
    <div className="flex flex-col items-center w-full" role="img" aria-label="Strength and pace target: red ball aims for center">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      <svg viewBox="0 0 300 300" className="w-full aspect-square" aria-hidden>
        <defs>
          <linearGradient id="dartboard-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.95)" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
          <filter id="dartboard-ball-shadow" x="-30%" y="-30%" width="160%" height="160%" filterUnits="userSpaceOnUse">
            <feDropShadow dx={0} dy={1.5} stdDeviation={0.5} floodColor="hsl(var(--foreground) / 0.2)" />
          </filter>
        </defs>
        {/* Outer ring: light orange fill, 1px stroke */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="hsl(var(--primary) / 0.1)"
          stroke="hsl(var(--dartboard-ring-outer))"
          strokeWidth={1}
        />
        {/* Middle ring */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.66}
          fill="hsl(var(--primary) / 0.32)"
          stroke="hsl(var(--dartboard-ring-mid))"
          strokeWidth={1}
        />
        {/* Inner bullseye */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.33}
          fill="url(#dartboard-center)"
          stroke="hsl(var(--dartboard-ring-inner))"
          strokeWidth={1}
        />
        {/* Red ball: goal is to keep it in the center */}
        <circle
          cx={cx}
          cy={cy}
          r={BALL_R}
          fill="hsl(var(--destructive))"
          stroke="hsl(var(--background))"
          strokeWidth={1.5}
          filter="url(#dartboard-ball-shadow)"
          className="transition-none"
        />
      </svg>
    </div>
  );
}
