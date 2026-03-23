"use client";

/**
 * Reusable two-axis realtime dartboard.
 * The visual behavior stays fixed while the axis meanings can change by step.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, useEffect } from "react";

const VIEWBOX_SIZE = 400;
const CENTER = 200;
const RADIUS = 185;
const INNER_RING_RADII = [130, 75, 30] as const;
const BALL_R = 10;
const SPRING_STIFFNESS = 0.045;
const SPRING_DAMPING = 0.86;
const MAX_VELOCITY = 1.5;
const MAX_TARGET_DELTA_TOWARD_EDGE = 0.014;
const MAX_TARGET_DELTA_TOWARD_CENTER = 0.035;
const SOFT_DEADZONE = 0.1;
const MIN_DIRECTION_ERROR = 0.12;
const TARGET_SCALE_EXP = 1.4;
const COHERENCE_STRENGTH = 0.88;
const COHERENCE_PACE = 0.85;
const COHERENCE_MS = 1200;
const AUTHORITY_MS = 4000;
const TENSION_EXP = 2.0;

function tension(score: number): number {
  return Math.pow(Math.max(0, 1 - score), TENSION_EXP);
}

function ballPosition(score: number, direction: number): number {
  const error = 1 - score;
  if (error < SOFT_DEADZONE) return 0;
  const effectiveDirection = error < MIN_DIRECTION_ERROR ? 0 : direction;
  let scaledError = (error - SOFT_DEADZONE) / (1 - SOFT_DEADZONE);
  scaledError = Math.pow(scaledError, TARGET_SCALE_EXP);
  const signed = effectiveDirection * scaledError;
  return Math.max(-1, Math.min(1, signed));
}

function getBallStatus(
  xScore: number,
  yScore: number,
  xDirection: number,
  yDirection: number,
  xNegativeHint: string,
  xPositiveHint: string,
  yNegativeHint: string,
  yPositiveHint: string
): string {
  if (xScore >= COHERENCE_STRENGTH && yScore >= COHERENCE_PACE) return "Presence stable.";
  const parts: string[] = [];
  if (xScore < COHERENCE_STRENGTH && xDirection !== 0) {
    parts.push(xDirection < 0 ? xNegativeHint : xPositiveHint);
  }
  if (yScore < COHERENCE_PACE && yDirection !== 0) {
    parts.push(yDirection < 0 ? yNegativeHint : yPositiveHint);
  }
  return parts.length ? parts.join(", ") + "." : "Presence stable.";
}

export interface RealtimeMetricDartboardProps {
  xScore: number;
  yScore: number;
  xDirection: number;
  yDirection: number;
  xAxisLabel: string;
  yAxisLabel: string;
  xNegativeHint: string;
  xPositiveHint: string;
  yNegativeHint: string;
  yPositiveHint: string;
}

export interface RealtimeMetricDartboardHandle {
  dampVelocityOnVoiceDrop: () => void;
  resetOnSilenceSettled: () => void;
}

export const RealtimeMetricDartboard = forwardRef<RealtimeMetricDartboardHandle, RealtimeMetricDartboardProps>(function RealtimeMetricDartboard(
  {
    xScore,
    yScore,
    xDirection,
    yDirection,
    xAxisLabel,
    yAxisLabel,
    xNegativeHint,
    xPositiveHint,
    yNegativeHint,
    yPositiveHint,
  },
  ref
) {
  const targetX = useMemo(() => ballPosition(xScore, xDirection), [xScore, xDirection]);
  const targetY = useMemo(() => ballPosition(yScore, yDirection), [yScore, yDirection]);

  const rawTargetRef = useRef({ x: targetX, y: targetY });
  rawTargetRef.current = { x: targetX, y: targetY };
  const targetRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const [displayPos, setDisplayPos] = useState({ x: 0, y: 0 });

  useImperativeHandle(
    ref,
    () => ({
      dampVelocityOnVoiceDrop() {
        velRef.current.x *= 0.4;
        velRef.current.y *= 0.4;
      },
      resetOnSilenceSettled() {
        targetRef.current.x = 0;
        targetRef.current.y = 0;
        rawTargetRef.current.x = 0;
        rawTargetRef.current.y = 0;
        velRef.current.x *= 0.3;
        velRef.current.y *= 0.3;
      },
    }),
    []
  );

  const isCoherent = xScore >= COHERENCE_STRENGTH && yScore >= COHERENCE_PACE;
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
      const raw = rawTargetRef.current;
      const t = targetRef.current;
      const p = posRef.current;
      const v = velRef.current;

      const moveToward = (current: number, goal: number, towardEdge: boolean): number => {
        const d = goal - current;
        const maxDelta = towardEdge ? MAX_TARGET_DELTA_TOWARD_EDGE : MAX_TARGET_DELTA_TOWARD_CENTER;
        if (Math.abs(d) <= maxDelta) return goal;
        return current + Math.sign(d) * maxDelta;
      };
      const towardEdgeX = Math.abs(raw.x) >= Math.abs(t.x);
      const towardEdgeY = Math.abs(raw.y) >= Math.abs(t.y);
      t.x = moveToward(t.x, raw.x, towardEdgeX);
      t.y = moveToward(t.y, raw.y, towardEdgeY);

      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const combinedMagnitude = Math.sqrt(dx * dx + dy * dy);
      const axisDamp = combinedMagnitude > 0.8 ? 0.85 : 1;
      v.x += dx * SPRING_STIFFNESS * axisDamp;
      v.y += dy * SPRING_STIFFNESS * axisDamp;
      v.x *= SPRING_DAMPING;
      v.y *= SPRING_DAMPING;
      v.x = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v.x));
      v.y = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v.y));
      p.x += v.x;
      p.y += v.y;
      if (Math.abs(p.x) < 0.0001) p.x = 0;
      if (Math.abs(p.y) < 0.0001) p.y = 0;
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
    xScore,
    yScore,
    xDirection,
    yDirection,
    xNegativeHint,
    xPositiveHint,
    yNegativeHint,
    yPositiveHint
  );

  const worstScore = Math.min(xScore, yScore);
  let t = tension(worstScore);
  if (worstScore < 1) {
    if (xDirection < 0) t *= 1.2;
    else if (xDirection > 0) t *= 0.7;
    if (yDirection > 0) t *= 0.8;
    t = Math.min(1, t);
  }
  const outerRingBaseOpacity = coherent ? 0.45 : 0.35;
  const outerRingOrangeOpacity = t * 0.5;
  const crosshairOpacity = authority ? 0.22 : coherent ? 0.18 : 0.12;
  const outerRingStrokeWidth = authority ? 1.5 : 1.25;
  const ballStrokeOpacity = coherent ? 0.6 : 0.5 + t * 0.5;
  const labelClassName =
    "pointer-events-none absolute text-sm font-medium tracking-wide text-[hsl(var(--muted-foreground))] sm:text-[15px]";

  return (
    <div
      className="flex flex-col items-center w-full"
      role="img"
      aria-label={`Realtime voice field: keep ${xAxisLabel.toLowerCase()} and ${yAxisLabel.toLowerCase()} centered`}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      <div className="relative w-full max-w-[520px] aspect-square px-9 py-9 sm:px-10 sm:py-10">
        <div className={`${labelClassName} left-1/2 top-0 -translate-x-1/2 text-center`}>
          {yPositiveHint}
        </div>
        <div className={`${labelClassName} left-1/2 bottom-0 -translate-x-1/2 text-center`}>
          {yNegativeHint}
        </div>
        <div className={`${labelClassName} left-0 top-1/2 -translate-y-1/2 text-left`}>
          {xNegativeHint}
        </div>
        <div className={`${labelClassName} right-0 top-1/2 -translate-y-1/2 text-right`}>
          {xPositiveHint}
        </div>

        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="h-full w-full"
          aria-hidden
        >
          <defs>
            <radialGradient id="apple-field" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="hsl(var(--background))" />
              <stop offset="100%" stopColor="hsl(var(--np-gray-soft))" />
            </radialGradient>
            <filter id="apple-ball-shadow" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
              <feDropShadow dx={0} dy={1} stdDeviation={1.2} floodColor="black" floodOpacity={0.12} />
            </filter>
            <filter id="apple-ball-shadow-coherent" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
              <feDropShadow dx={0} dy={1} stdDeviation={1.2} floodColor="black" floodOpacity={0.08} />
            </filter>
          </defs>

          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#apple-field)" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="hsl(var(--np-orange-soft))"
            strokeWidth={outerRingStrokeWidth}
            opacity={0.7}
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
          {INNER_RING_RADII.map((radius, index) => (
            <circle
              key={radius}
              cx={CENTER}
              cy={CENTER}
              r={radius}
              fill="none"
              stroke="hsl(var(--np-gray-mid))"
              strokeWidth={index === INNER_RING_RADII.length - 1 ? 0.9 : 0.8}
              opacity={index === INNER_RING_RADII.length - 1 ? 0.4 : 0.32}
              className="apple-transition"
            />
          ))}

          <line
            x1={CENTER}
            y1={CENTER - RADIUS}
            x2={CENTER}
            y2={CENTER + RADIUS}
            stroke="hsl(var(--np-gray-mid))"
            strokeWidth={0.5}
            opacity={crosshairOpacity}
            className="apple-transition"
          />
          <line
            x1={CENTER - RADIUS}
            y1={CENTER}
            x2={CENTER + RADIUS}
            y2={CENTER}
            stroke="hsl(var(--np-gray-mid))"
            strokeWidth={0.5}
            opacity={crosshairOpacity}
            className="apple-transition"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={10}
            fill="none"
            stroke="hsl(var(--np-orange))"
            strokeWidth={1.5}
            opacity={0.95}
          />
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
    </div>
  );
});

export type StrengthPaceDartboardHandle = RealtimeMetricDartboardHandle;
export type StrengthPaceDartboardProps = RealtimeMetricDartboardProps;
export const StrengthPaceDartboard = RealtimeMetricDartboard;
