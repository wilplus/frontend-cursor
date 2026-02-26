"use client";

/**
 * A2-Light Apple-style strength + pace field.
 * Calm, visible, subtle depth. No drama, no punishment.
 * Silence = grounded center. Motion = magnetic glide.
 */

import { useRef, useState, useEffect, useMemo } from "react";

/* ─── constants ──────────────────────────────────────────────── */

const VIEWBOX = 300;
const CENTER = 150;
const RADIUS = 120;
const BALL_R = 12;

const LERP = 0.075;

const STATUS_THRESH = 0.2;

/* ─── accessibility ──────────────────────────────────────────── */

function getBallStatus(x: number, y: number): string {
  const parts: string[] = [];
  if (x < -STATUS_THRESH) parts.push("Low activation");
  else if (x > STATUS_THRESH) parts.push("High activation");
  if (y < -STATUS_THRESH) parts.push("Slower pace");
  else if (y > STATUS_THRESH) parts.push("Faster pace");
  return parts.length ? parts.join(", ") + "." : "Presence stable.";
}

/* ─── types ──────────────────────────────────────────────────── */

export interface StrengthPaceDartboardProps {
  targetX: number;
  targetY: number;
}

/* ─── component ──────────────────────────────────────────────── */

export function StrengthPaceDartboard({ targetX, targetY }: StrengthPaceDartboardProps) {
  const targetRef = useRef({ x: 0, y: 0 });
  targetRef.current.x = targetX;
  targetRef.current.y = targetY;

  const [displayPos, setDisplayPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame: number;

    const animate = () => {
      setDisplayPos((prev) => {
        const tx = targetRef.current.x;
        const ty = targetRef.current.y;
        const dx = tx - prev.x;
        const dy = ty - prev.y;

        const nextX = Math.abs(dx) < 0.001 ? tx : prev.x + dx * LERP;
        const nextY = Math.abs(dy) < 0.001 ? ty : prev.y + dy * LERP;

        return { x: nextX, y: nextY };
      });

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const ballX = displayPos.x * RADIUS;
  const ballY = -displayPos.y * RADIUS;

  const statusText = useMemo(
    () => getBallStatus(displayPos.x, displayPos.y),
    [
      displayPos.x < -STATUS_THRESH ? -1 : displayPos.x > STATUS_THRESH ? 1 : 0,
      displayPos.y < -STATUS_THRESH ? -1 : displayPos.y > STATUS_THRESH ? 1 : 0,
    ],
  );

  return (
    <div
      className="relative rounded-full"
      style={{ background: "#F5F5F7" }}
      role="img"
      aria-label="Strength and pace feedback field"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="fieldGradient" cx="50%" cy="48%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="65%" stopColor="rgba(255,255,255,0.65)" />
            <stop offset="100%" stopColor="rgba(230,230,235,0.9)" />
          </radialGradient>
        </defs>

        {/* field */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="url(#fieldGradient)"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />

        {/* outer ring — softer so focus stays on ball */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={2}
        />

        {/* mid ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS * 0.6}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={1.5}
        />

        {/* inner ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS * 0.25}
          fill="none"
          stroke="rgba(0,0,0,0.04)"
          strokeWidth={1}
        />

        {/* crosshair */}
        <line
          x1={CENTER - RADIUS}
          y1={CENTER}
          x2={CENTER + RADIUS}
          y2={CENTER}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={1.2}
        />
        <line
          x1={CENTER}
          y1={CENTER - RADIUS}
          x2={CENTER}
          y2={CENTER + RADIUS}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={1.2}
        />

        {/* ball: size 12, premium feel — confidently visible for coaching */}
        <circle
          cx={CENTER + ballX}
          cy={CENTER - ballY}
          r={12}
          fill="#FF6A00"
          stroke="#FFFFFF"
          strokeWidth={2.5}
        />
        {/* subtle highlight — physical depth, no glow */}
        <circle
          cx={CENTER + ballX - 2}
          cy={CENTER - ballY - 2}
          r={4}
          fill="rgba(255,255,255,0.45)"
          pointerEvents="none"
        />
      </svg>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </div>
  );
}
