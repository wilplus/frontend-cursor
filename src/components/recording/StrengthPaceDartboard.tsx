"use client";

/**
 * Neuro-performance strength + pace field.
 * Neural-field style: radial gradients, hemisphere direction cues, precision spring,
 * coherence state, micro-frequency pulse. Cognitive alignment instrument, not gamified target.
 */
import { useMemo, useRef, useState, useEffect } from "react";

const VIEWBOX_SIZE = 300;
const RADIUS = 120;
const BALL_R = 10;

/** Micro-deadzone: score above this → ball target 0 (no jitter). */
const DEADZONE_SCORE = 0.92;
/** Neuro spring: controlled, no bounce. stiffness 0.045, damping 0.82 */
const SPRING_STIFFNESS = 0.045;
const SPRING_DAMPING = 0.82;
/** Coherence: both axes above this for COHERENCE_MS → neural alignment state. */
const COHERENCE_SCORE = 0.94;
const COHERENCE_MS = 800;
/** Pulse: show when either axis below this. Slight pulse 0.5–0.7, strong < 0.5 */
const PULSE_SLIGHT_THRESHOLD = 0.7;
const PULSE_STRONG_THRESHOLD = 0.5;

/** Position in [-1, 1] from score and direction; deadzone when score >= DEADZONE_SCORE. */
function ballPosition(score: number, direction: number): number {
  if (score >= DEADZONE_SCORE) return 0;
  const error = 1 - score;
  const signed = direction * error;
  return Math.max(-1, Math.min(1, signed));
}

/** Neuro tone: Aligned / Over drive / Low drive / Over pace / Under pace */
function getBallStatus(
  strengthScore: number,
  paceScore: number,
  strengthDirection: number,
  paceDirection: number
): string {
  if (strengthScore >= COHERENCE_SCORE && paceScore >= COHERENCE_SCORE)
    return "Aligned.";
  const parts: string[] = [];
  if (strengthScore < COHERENCE_SCORE && strengthDirection !== 0)
    parts.push(strengthDirection < 0 ? "Low drive" : "Over drive");
  if (paceScore < COHERENCE_SCORE)
    parts.push(paceDirection < 0 ? "Under pace" : "Over pace");
  return parts.length ? parts.join(", ") + "." : "Aligned.";
}

/** Half-circle clip paths: top, bottom, left, right. Center 150,150 radius 120. */
const HEMISPHERE_PATHS = {
  top: "M 30 150 A 120 120 0 0 1 150 30 A 120 120 0 0 1 270 150 Z",
  bottom: "M 270 150 A 120 120 0 0 1 150 270 A 120 120 0 0 1 30 150 Z",
  left: "M 150 30 A 120 120 0 0 1 30 150 A 120 120 0 0 1 150 270 Z",
  right: "M 150 270 A 120 120 0 0 1 270 150 A 120 120 0 0 1 150 30 Z",
} as const;

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
    strengthScore >= COHERENCE_SCORE && paceScore >= COHERENCE_SCORE;
  const coherentStartRef = useRef<number | null>(null);
  const [showCoherenceGlow, setShowCoherenceGlow] = useState(false);

  const isOffTarget =
    strengthScore < PULSE_SLIGHT_THRESHOLD || paceScore < PULSE_SLIGHT_THRESHOLD;
  const pulseStrong =
    strengthScore < PULSE_STRONG_THRESHOLD || paceScore < PULSE_STRONG_THRESHOLD;

  useEffect(() => {
    const now = Date.now();
    if (isCoherent) {
      if (coherentStartRef.current === null) coherentStartRef.current = now;
      if (now - (coherentStartRef.current ?? now) >= COHERENCE_MS)
        setShowCoherenceGlow(true);
    } else {
      coherentStartRef.current = null;
      setShowCoherenceGlow(false);
    }
  }, [isCoherent]);

  // Spring physics (neuro: stiff, damped, no bounce)
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

  const cx = center + displayPos.x * RADIUS;
  const cy = center - displayPos.y * RADIUS;
  const statusText = getBallStatus(
    strengthScore,
    paceScore,
    strengthDirection,
    paceDirection
  );

  // Hemisphere overlay opacity: direction cue (field distortion). Max opacity ~0.25, subtle.
  const topOpacity = paceDirection === 1 ? (1 - paceScore) * 0.25 : 0;
  const bottomOpacity = paceDirection === -1 ? (1 - paceScore) * 0.25 : 0;
  const leftOpacity = strengthDirection === -1 ? (1 - strengthScore) * 0.25 : 0;
  const rightOpacity = strengthDirection === 1 ? (1 - strengthScore) * 0.25 : 0;

  // Ball/glow color token from dominant deviation (neuro palette).
  const worstScore = Math.min(strengthScore, paceScore);
  const ballGlowToken = useMemo((): string => {
    if (worstScore >= COHERENCE_SCORE) return "neuro-perfect";
    if (strengthScore < paceScore) {
      return strengthDirection < 0 ? "neuro-weak" : "neuro-strong";
    }
    return paceDirection < 0 ? "neuro-slow" : "neuro-fast";
  }, [worstScore, strengthScore, paceScore, strengthDirection, paceDirection]);

  const transitionClass = "neuro-dartboard-transition";

  return (
    <div
      className="flex flex-col items-center w-full"
      role="img"
      aria-label="Neural alignment: keep drive and pace in the center"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      <svg viewBox="0 0 300 300" className="w-full aspect-square" aria-hidden>
        <defs>
          {/* Neural field: radial gradient (soft center → fade to edge) */}
          <radialGradient
            id="neuro-field-outer"
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor="hsl(var(--neuro-perfect))" stopOpacity="0.08" />
            <stop offset="40%" stopColor="hsl(var(--neuro-perfect))" stopOpacity="0.03" />
            <stop offset="100%" stopColor="hsl(var(--neuro-perfect))" stopOpacity="0.02" />
          </radialGradient>
          <radialGradient
            id="neuro-field-inner"
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor="hsl(var(--neuro-perfect))" stopOpacity="0.9" />
            <stop offset="40%" stopColor="hsl(var(--neuro-perfect))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--neuro-perfect))" stopOpacity="0.05" />
          </radialGradient>
          {/* Hemisphere direction overlays: top=fast, bottom=slow, left=weak, right=strong */}
          <linearGradient id="neuro-hemisphere-top" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--neuro-fast))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--neuro-fast))" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="neuro-hemisphere-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--neuro-slow))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--neuro-slow))" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="neuro-hemisphere-left" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--neuro-weak))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--neuro-weak))" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="neuro-hemisphere-right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--neuro-strong))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--neuro-strong))" stopOpacity="0.6" />
          </linearGradient>
          <filter id="neuro-ball-shadow" x="-40%" y="-40%" width="180%" height="180%" filterUnits="userSpaceOnUse">
            <feDropShadow dx={0} dy={1} stdDeviation={0.5} floodColor="hsl(var(--foreground) / 0.15)" />
          </filter>
          <filter id="neuro-coherence-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          </filter>
        </defs>

        {/* Crosshair: thin axes (neuro data layer) */}
        <line x1={center} y1={0} x2={center} y2={VIEWBOX_SIZE} stroke="hsl(var(--foreground))" strokeWidth={0.5} opacity={0.15} />
        <line x1={0} y1={center} x2={VIEWBOX_SIZE} y2={center} stroke="hsl(var(--foreground))" strokeWidth={0.5} opacity={0.15} />

        {/* Outer ring: thin stroke, low opacity (neural field boundary) */}
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="url(#neuro-field-outer)"
          stroke="hsl(var(--foreground))"
          strokeWidth={0.75}
          opacity={0.35}
          className={transitionClass}
        />
        {/* Middle ring: gradient fade */}
        <circle
          cx={center}
          cy={center}
          r={RADIUS * 0.66}
          fill="url(#neuro-field-outer)"
          stroke="hsl(var(--foreground))"
          strokeWidth={0.75}
          opacity={0.25}
          className={transitionClass}
        />
        {/* Hemisphere direction overlays (field distortion) */}
        {topOpacity > 0 && (
          <path
            d={HEMISPHERE_PATHS.top}
            fill="url(#neuro-hemisphere-top)"
            opacity={topOpacity}
            className={transitionClass}
            style={{ transitionDuration: "300ms" }}
          />
        )}
        {bottomOpacity > 0 && (
          <path
            d={HEMISPHERE_PATHS.bottom}
            fill="url(#neuro-hemisphere-bottom)"
            opacity={bottomOpacity}
            className={transitionClass}
            style={{ transitionDuration: "300ms" }}
          />
        )}
        {leftOpacity > 0 && (
          <path
            d={HEMISPHERE_PATHS.left}
            fill="url(#neuro-hemisphere-left)"
            opacity={leftOpacity}
            className={transitionClass}
            style={{ transitionDuration: "300ms" }}
          />
        )}
        {rightOpacity > 0 && (
          <path
            d={HEMISPHERE_PATHS.right}
            fill="url(#neuro-hemisphere-right)"
            opacity={rightOpacity}
            className={transitionClass}
            style={{ transitionDuration: "300ms" }}
          />
        )}
        {/* Inner bullseye: radial gradient (neural alignment zone) */}
        <circle
          cx={center}
          cy={center}
          r={RADIUS * 0.33}
          fill="url(#neuro-field-inner)"
          stroke="hsl(var(--foreground))"
          strokeWidth={0.75}
          opacity={0.9}
          className={transitionClass}
        />
        {/* Coherence glow: when both > 0.94 for 800ms */}
        {showCoherenceGlow && (
          <circle
            cx={center}
            cy={center}
            r={RADIUS * 0.42}
            fill="hsl(var(--neuro-perfect) / 0.4)"
            filter="url(#neuro-coherence-glow)"
            className="neuro-coherence-glow"
          />
        )}
        {/* Ball glow: intensity by error, color by state (neuro palette); micro-frequency pulse when off */}
        <circle
          cx={cx}
          cy={cy}
          r={BALL_R + 8}
          fill={`hsl(var(--${ballGlowToken}))`}
          opacity={0.2 + (1 - worstScore) * 0.15}
          className={`${transitionClass} ${showCoherenceGlow ? "" : isOffTarget ? (pulseStrong ? "neuro-ball-pulse-strong" : "neuro-ball-pulse-slight") : ""}`}
          style={{ transitionDuration: "250ms" }}
        />
        {/* Ball: neuro color; no pulse when coherent */}
        <circle
          cx={cx}
          cy={cy}
          r={BALL_R}
          fill={`hsl(var(--${ballGlowToken}))`}
          stroke="hsl(var(--background))"
          strokeWidth={1}
          filter="url(#neuro-ball-shadow)"
          className={transitionClass}
          style={{ transitionDuration: "200ms" }}
        />
      </svg>
    </div>
  );
}
