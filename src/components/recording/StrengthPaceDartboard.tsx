"use client";

/**
 * Strength + Pace sniper field.
 *
 * Takes pre-filtered signed positions from the hook.
 * Animates with a spring for 60fps visual smoothness.
 * White + orange on-brand. Feedback via structural tension only.
 */

import { useRef, useState, useEffect, useMemo } from "react";

/* ─── constants ──────────────────────────────────────────────── */

const VIEWBOX = 300;
const CENTER = 150;
const RADIUS = 120;
const BALL_R = 10;

// spring
const STIFFNESS = 0.045;
const DAMPING = 0.86;
const MAX_VEL = 1.5;

// coherence detection
const COHERENCE_DIST = 0.15;
const COHERENCE_MS = 1200;
const AUTHORITY_MS = 4000;
const TENSION_EXP = 2.0;

// accessibility
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
  /** Signed X: −1 too quiet … 0 perfect … +1 too loud */
  targetX: number;
  /** Signed Y: −1 too slow … 0 perfect … +1 too fast */
  targetY: number;
}

/* ─── component ──────────────────────────────────────────────── */

export function StrengthPaceDartboard({ targetX, targetY }: StrengthPaceDartboardProps) {
  // target ref so animation loop always reads latest without restarting
  const targetRef = useRef({ x: 0, y: 0 });
  targetRef.current.x = targetX;
  targetRef.current.y = targetY;

  const [display, setDisplay] = useState({
    x: 0,
    y: 0,
    isCoherent: false,
    hasAuthority: false,
    tension: 0,
  });

  const spring = useRef({ px: 0, py: 0, vx: 0, vy: 0, cohSince: null as number | null });
  const rafRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const s = spring.current;
      const t = targetRef.current;
      const now = performance.now();

      // spring physics
      const fx = (t.x - s.px) * STIFFNESS;
      const fy = (t.y - s.py) * STIFFNESS;
      s.vx = (s.vx + fx) * DAMPING;
      s.vy = (s.vy + fy) * DAMPING;

      const speed = Math.hypot(s.vx, s.vy);
      if (speed > MAX_VEL) {
        const sc = MAX_VEL / speed;
        s.vx *= sc;
        s.vy *= sc;
      }

      s.px += s.vx;
      s.py += s.vy;

      // coherence / authority
      const dist = Math.hypot(s.px, s.py);
      if (dist <= COHERENCE_DIST) {
        if (s.cohSince === null) s.cohSince = now;
      } else {
        s.cohSince = null;
      }
      const cohMs = s.cohSince !== null ? now - s.cohSince : 0;

      setDisplay({
        x: s.px,
        y: s.py,
        isCoherent: cohMs >= COHERENCE_MS,
        hasAuthority: cohMs >= AUTHORITY_MS,
        tension: Math.pow(Math.min(dist, 1), TENSION_EXP),
      });
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // runs once; reads targets from ref

  /* ── derived visuals ── */
  const ballCx = CENTER + display.x * RADIUS;
  const ballCy = CENTER - display.y * RADIUS; // Y flipped: +1 (fast) is UP

  const outerW = display.hasAuthority ? 2.5 : 1.5;
  const outerOpacity = 0.15 + display.tension * 0.4;
  const midOpacity = 0.1 + display.tension * 0.2;
  const crossOpacity = display.isCoherent ? 0.35 : 0.12;

  const statusText = useMemo(
    () => getBallStatus(display.x, display.y),
    // only recompute when the quadrant actually changes
    [
      display.x < -STATUS_THRESH ? -1 : display.x > STATUS_THRESH ? 1 : 0,
      display.y < -STATUS_THRESH ? -1 : display.y > STATUS_THRESH ? 1 : 0,
    ],
  );

  return (
    <div className="relative" role="img" aria-label="Strength and pace feedback field">
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="spFieldGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity={0.03} />
            <stop offset="100%" stopColor="white" stopOpacity={0.01} />
          </radialGradient>
        </defs>

        {/* field */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#spFieldGrad)" />

        {/* outer ring */}
        <circle
          cx={CENTER} cy={CENTER} r={RADIUS}
          fill="none" stroke="white"
          strokeWidth={outerW} opacity={outerOpacity}
        />
        {/* tension overlay */}
        {display.tension > 0.05 && (
          <circle
            cx={CENTER} cy={CENTER} r={RADIUS}
            fill="none" stroke="#F97316"
            strokeWidth={outerW} opacity={display.tension * 0.35}
          />
        )}

        {/* mid ring */}
        <circle
          cx={CENTER} cy={CENTER} r={RADIUS * 0.6}
          fill="none" stroke="white"
          strokeWidth={1} opacity={midOpacity}
        />

        {/* inner ring (sweet spot) */}
        <circle
          cx={CENTER} cy={CENTER} r={RADIUS * 0.25}
          fill="none" stroke="white"
          strokeWidth={1} opacity={0.08}
        />

        {/* crosshair */}
        <line
          x1={CENTER - RADIUS} y1={CENTER}
          x2={CENTER + RADIUS} y2={CENTER}
          stroke="white" strokeWidth={0.5} opacity={crossOpacity}
        />
        <line
          x1={CENTER} y1={CENTER - RADIUS}
          x2={CENTER} y2={CENTER + RADIUS}
          stroke="white" strokeWidth={0.5} opacity={crossOpacity}
        />

        {/* ball */}
        <circle
          cx={ballCx} cy={ballCy} r={BALL_R}
          fill="white"
          fillOpacity={0.85}
          stroke={display.isCoherent ? "white" : "rgba(255,255,255,0.3)"}
          strokeWidth={display.isCoherent ? 2 : 1}
        />
      </svg>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </div>
  );
}
