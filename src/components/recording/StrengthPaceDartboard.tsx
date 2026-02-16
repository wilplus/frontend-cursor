"use client";

/**
 * Apple-precision strength + pace field.
 * White + orange, on-brand: clean, high-clarity, no glow/pulse. Feedback via structural tension only.
 */
import { useMemo, useRef, useState, useEffect } from "react";

const VIEWBOX_SIZE = 300;
const CENTER = 150;
const RADIUS = 120;
const BALL_R = 10;

const DEADZONE_SCORE = 0.92;
/** iOS-level spring: firm, no bounce. */
const SPRING_STIFFNESS = 0.05;
const SPRING_DAMPING = 0.82;
/** Public speaking: reward sustained control, not lab precision. */
const COHERENCE_STRENGTH = 0.88;
const COHERENCE_PACE = 0.85;
const COHERENCE_MS = 1200;
/** Sustained authority: 4+ seconds stable → ring thickens, crosshair sharper. */
const AUTHORITY_MS = 4000;
/** Anxiety reduction: small deviations almost entirely ignored. */
const TENSION_EXP = 2.0;

function tension(score: number): number {
  return Math.pow(Math.max(0, 1 - score), TENSION_EXP);
}

function ballPosition(score: number, direction: number): number {
  if (score >= DEADZONE_SCORE) return 0;
  const error = 1 - score;
  const signed = direction * error;
  return Math.max(-1, Math.min(1, signed));
}

/** Public speaking: presence language (not correction). */
function getBallStatus(
  strengthScore: number,
  paceScore: number,
  strengthDirection: number,
  paceDirection: number
): string {
  if (strengthScore >= COHERENCE_STRENGTH && paceScore >= COHERENCE_PACE)
    return "Presence stable.";
  const parts: string[] = [];
  if (strengthScore < COHERENCE_STRENGTH && strengthDirection !== 0)
    parts.push(strengthDirection < 0 ? "Low activation" : "High activation");
  if (paceScore < COHERENCE_PACE)
    parts.push(paceDirection < 0 ? "Slower pace" : "Faster pace");
  return parts.length ? parts.join(", ") + "." : "Presence stable.";
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
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const [displayPos, setDisplayPos] = useState({ x: 0, y: 0 });

  const isCoherent =
    strengthScore >= COHERENCE_STRENGTH && paceScore >= COHERENCE_PACE;
  const coherentStartRef = useRef<number | null>(null);
  const [coherent, setCoherent] = useState(false);
  const [authority, setAuthority] = useState(false);

  useEffect(() => {
    const now = Date.now();
    if (isCoherent) {
      if (coherentStartRef.current === null) coherentStartRef.current = now;
      const elapsed = now - (coherentStartRef.current ?? now);
      setCoherent(elapsed >= COHERENCE_MS);
      setAuthority(elapsed >= AUTHORITY_MS);
    } else {
      coherentStartRef.current = null;
      setCoherent(false);
      setAuthority(false);
    }
  }, [isCoherent]);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const t = targetRef.current;
      const p = posRef.current;
      const v = velRef.current;
      v.x += (t.x - p.x) * SPRING_STIFFNESS;
      v.y += (t.y - p.y) * SPRING_STIFFNESS;
      v.x *= SPRING_DAMPING;
      v.y *= SPRING_DAMPING;
      p.x += v.x;
      p.y += v.y;
      setDisplayPos({ x: p.x, y: p.y });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const ballX = displayPos.x * RADIUS;
  const ballY = -displayPos.y * RADIUS;
  const cx = CENTER + ballX;
  const cy = CENTER + ballY;
  const statusText = getBallStatus(
    strengthScore,
    paceScore,
    strengthDirection,
    paceDirection
  );

  const worstScore = Math.min(strengthScore, paceScore);
  let t = tension(worstScore);
  if (worstScore < 1) {
    if (strengthDirection < 0) t *= 1.2;
    else if (strengthDirection > 0) t *= 0.7;
    if (paceDirection > 0) t *= 0.8;
    t = Math.min(1, t);
  }
  /** Structural tension: outer ring base (gray), orange overlay when error. */
  const outerRingBaseOpacity = coherent ? 0.45 : 0.35;
  const outerRingOrangeOpacity = t * 0.5;
  const crosshairOpacity = authority ? 0.22 : coherent ? 0.18 : 0.12;
  const outerRingStrokeWidth = authority ? 1 : 0.75;
  /** Ball stroke: soft orange when coherent, more defined when tension. */
  const ballStrokeOpacity = coherent ? 0.6 : 0.5 + t * 0.5;

  return (
    <div
      className="flex flex-col items-center w-full"
      role="img"
      aria-label="Vocal presence: keep drive and pace centered"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      <svg viewBox="0 0 300 300" className="w-full aspect-square" aria-hidden>
        <defs>
          <radialGradient id="apple-field" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="hsl(var(--np-gray-soft))" />
          </radialGradient>
          <filter id="apple-ball-shadow" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
            <feDropShadow dx={0} dy={1} stdDeviation={1.2} floodColor="black" floodOpacity={0.12} />
          </filter>
          <filter id="apple-ball-shadow-coherent" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
            <feDropShadow dx={0} dy={1} stdDeviation={1.2} floodColor="black" floodOpacity={0.08} />
          </filter>
        </defs>

        {/* Base field */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#apple-field)" />

        {/* Outer ring: gray base; orange overlay for structural tension; thickens with authority */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--np-gray-mid))"
          strokeWidth={outerRingStrokeWidth}
          opacity={outerRingBaseOpacity}
          className="apple-transition"
        />
        {outerRingOrangeOpacity > 0 && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="hsl(var(--np-orange))"
            strokeWidth={outerRingStrokeWidth}
            opacity={outerRingOrangeOpacity}
            className="apple-transition"
          />
        )}
        {/* Mid ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={80}
          fill="none"
          stroke="hsl(var(--np-gray-mid))"
          strokeWidth={0.75}
          opacity={0.25}
          className="apple-transition"
        />
        {/* Inner ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={40}
          fill="none"
          stroke="hsl(var(--np-gray-mid))"
          strokeWidth={0.75}
          opacity={0.2}
          className="apple-transition"
        />

        {/* Crosshair */}
        <line
          x1={CENTER}
          y1={30}
          x2={CENTER}
          y2={270}
          stroke="hsl(var(--np-gray-deep))"
          strokeWidth={0.5}
          opacity={crosshairOpacity}
          className="apple-transition"
        />
        <line
          x1={30}
          y1={CENTER}
          x2={270}
          y2={CENTER}
          stroke="hsl(var(--np-gray-deep))"
          strokeWidth={0.5}
          opacity={crosshairOpacity}
          className="apple-transition"
        />

        {/* Ball: white, thin orange ring, soft shadow */}
        <circle
          cx={cx}
          cy={cy}
          r={BALL_R}
          fill="white"
          stroke="hsl(var(--np-orange))"
          strokeWidth={1.25}
          strokeOpacity={ballStrokeOpacity}
          filter={coherent ? "url(#apple-ball-shadow-coherent)" : "url(#apple-ball-shadow)"}
          className="apple-transition"
        />
      </svg>
    </div>
  );
}
