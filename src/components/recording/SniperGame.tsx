"use client";

/**
 * Live Coach — Game Mode.
 * Physics ball on a 2D target. Center = perfect on both axes.
 * Y-axis = flow:  up = too rushed (few pauses), down = too choppy (many pauses).
 * X-axis = pace:  right = too fast, left = too slow.
 * Ball color = coach color (green / yellow / red / gray).
 */

import { useRef, useEffect, useState } from "react";
import type { LiveCoachState } from "@/lib/sniper/types";

const VB = 240;
const CX = 120;
const CY = 120;
const R_BULL = 24;
const R_STAB = 56;
const R_OUTER = 90;

const SPRING_K = 0.055;
const DAMPING = 0.84;

const COLOR: Record<string, string> = {
  green: "#2E9E6F",
  yellow: "#D6A23D",
  red: "#C94F4F",
  gray: "#9CA3AF",
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export interface SniperGameProps {
  state: LiveCoachState;
  taskLabel?: string;
  audioError?: boolean;
}

export function SniperGame({ state, taskLabel, audioError = false }: SniperGameProps) {
  const physRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const comboRef = useRef({ frameCount: 0, count: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  const [display, setDisplay] = useState({
    x: 0,
    y: 0,
    combo: 0,
    zone: "outer" as "bull" | "stab" | "outer",
  });

  // Recompute target position whenever state changes
  useEffect(() => {
    // Y: flowOffset (+1 = rushed = ball up, -1 = choppy = ball down)
    const ty = clamp(-state.flowOffset * R_OUTER, -R_OUTER, R_OUTER);
    // X: paceOffset (always 0 until WPM wired)
    const tx = clamp(state.paceOffset * R_OUTER, -R_OUTER, R_OUTER);
    targetRef.current = { x: tx, y: ty };
  }, [state.flowOffset, state.paceOffset]);

  // RAF spring-physics loop
  useEffect(() => {
    function tick() {
      const p = physRef.current;
      const t = targetRef.current;

      p.vx = p.vx * DAMPING + (t.x - p.x) * SPRING_K;
      p.vy = p.vy * DAMPING + (t.y - p.y) * SPRING_K;
      p.x += p.vx;
      p.y += p.vy;

      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      const zone: "bull" | "stab" | "outer" =
        dist <= R_BULL ? "bull" : dist <= R_STAB ? "stab" : "outer";

      const c = comboRef.current;
      if (zone === "bull") {
        c.frameCount++;
        c.count = Math.floor(c.frameCount / 60);
      } else if (zone === "outer") {
        c.frameCount = 0;
        c.count = 0;
      }

      frameCountRef.current++;
      if (frameCountRef.current % 2 === 0) {
        setDisplay({ x: p.x, y: p.y, combo: c.count, zone });
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const ballX = CX + display.x;
  const ballY = CY + display.y;
  const ringColor = audioError ? COLOR.yellow : COLOR[state.coachColor] ?? COLOR.gray;
  const isGreen = !audioError && state.coachColor === "green";
  const isGray = state.coachColor === "gray" || state.silenceGated;

  const cueText = audioError
    ? "Mic signal interrupted — check your audio device."
    : state.coachingCue || "Good flow — hold it.";

  return (
    <div className="w-full flex flex-col items-center py-1">
      {taskLabel ? (
        <p className="mb-2 text-lg sm:text-xl font-bold leading-snug text-foreground text-center px-2">
          {taskLabel}
        </p>
      ) : null}

      {/* Game arena */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          style={{ width: "min(92vw, 56svh, 480px)", height: "min(92vw, 56svh, 480px)" }}
          aria-label={`Flow score ${state.performanceScore}%. ${cueText}`}
        >
          {/* Outer ring */}
          <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="#E5E7EB" strokeWidth={1.5} />
          {/* Stability ring */}
          <circle cx={CX} cy={CY} r={R_STAB} fill="none" stroke="#E5E7EB" strokeWidth={1.5} />
          {/* Bullseye */}
          <circle
            cx={CX}
            cy={CY}
            r={R_BULL}
            fill={display.zone === "bull" ? "rgba(46,158,111,0.12)" : "rgba(229,231,235,0.4)"}
            stroke={display.zone === "bull" ? "#2E9E6F" : "#D1D5DB"}
            strokeWidth={1.5}
          />
          {/* Crosshairs — only Y line visible (X always 0) */}
          <line x1={CX} y1={CY - R_OUTER} x2={CX} y2={CY + R_OUTER} stroke="#E5E7EB" strokeWidth={0.8} />
          <line x1={CX - R_OUTER} y1={CY} x2={CX + R_OUTER} y2={CY} stroke="#E5E7EB" strokeWidth={0.8} />
          {/* Ball glow — idle pulse when gray, bigger + brighter when green */}
          <circle
            cx={ballX}
            cy={ballY}
            r={isGreen ? 18 : 13}
            fill={ringColor}
            opacity={isGreen ? 0.22 : 0.15}
          >
            {isGray && (
              <>
                <animate attributeName="r" values="10;18;10" dur="2.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.08;0.2;0.08" dur="2.6s" repeatCount="indefinite" />
              </>
            )}
            {isGreen && (
              <>
                <animate attributeName="r" values="16;22;16" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.18;0.28;0.18" dur="1.8s" repeatCount="indefinite" />
              </>
            )}
          </circle>
          {/* Ball */}
          <circle cx={ballX} cy={ballY} r={9} fill={ringColor} opacity={0.9} />
          <circle cx={ballX} cy={ballY} r={3.5} fill="white" opacity={0.95} />
        </svg>

        {/* Score overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p
            className="text-4xl font-semibold tabular-nums"
            style={{ color: ringColor, opacity: 0.22 }}
          >
            {state.silenceGated ? "—" : `${state.performanceScore}%`}
          </p>
        </div>

        {/* Combo badge */}
        {display.combo > 0 ? (
          <div className="absolute top-2 right-2 bg-[#2E9E6F] text-white rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums shadow-sm">
            {display.combo}s
          </div>
        ) : null}
      </div>

      {/* Coaching strip */}
      <div className="mt-3 w-full px-1">
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex overflow-hidden">
          <div
            className="w-1 flex-shrink-0 rounded-l-xl"
            style={{ backgroundColor: audioError ? COLOR.yellow : ringColor }}
          />
          <div className="p-3">
            {audioError ? (
              <p className="text-sm text-[#1F2933] flex items-center gap-1.5">
                <span style={{ color: COLOR.yellow }} aria-hidden>⚠</span>
                {cueText}
              </p>
            ) : (
              <p className="text-sm text-[#1F2933]">{cueText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
