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
const DEAD_ZONE_RADIUS_NORM = 0.2;
const LOCK_HOLD_MS = 1500;
const MAX_X_DELTA_PX = R_OUTER * 0.08;

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
  const physRef = useRef({ x: 0, y: 0 });
  const comboRef = useRef({ frameCount: 0, count: 0 });
  const lockSinceRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const fillerFadeTimerRef = useRef<number | null>(null);

  const [display, setDisplay] = useState({
    x: 0,
    y: 0,
    combo: 0,
    zone: "outer" as "bull" | "stab" | "outer",
  });
  const [lockedVisual, setLockedVisual] = useState(false);
  const [fillerFlashVisible, setFillerFlashVisible] = useState(false);

  // Recompute target position whenever state changes
  useEffect(() => {
    // Y: flowOffset (+1 = rushed = ball up, -1 = choppy = ball down)
    let ty = clamp(-state.flowOffset * R_OUTER, -R_OUTER, R_OUTER);
    // X: paceOffset (always 0 until WPM wired)
    let tx = clamp(state.paceOffset * R_OUTER, -R_OUTER, R_OUTER);
    const radialNorm = Math.sqrt((tx / R_OUTER) ** 2 + (ty / R_OUTER) ** 2);
    if (radialNorm < DEAD_ZONE_RADIUS_NORM) {
      tx = 0;
      ty = 0;
    }
    targetRef.current = { x: tx, y: ty };
  }, [state.flowOffset, state.paceOffset]);

  // RAF spring-physics loop
  useEffect(() => {
    function tick() {
      const p = physRef.current;
      const t = targetRef.current;
      const now = performance.now();

      const currDist = Math.sqrt(p.x * p.x + p.y * p.y);
      const targetDist = Math.sqrt(t.x * t.x + t.y * t.y);
      const alpha = targetDist < currDist ? 0.3 : 0.12;

      const dx = clamp((t.x - p.x) * alpha, -MAX_X_DELTA_PX, MAX_X_DELTA_PX);
      const dy = (t.y - p.y) * alpha;
      p.x += dx;
      p.y += dy;

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

      if (dist <= R_OUTER * DEAD_ZONE_RADIUS_NORM) {
        if (lockSinceRef.current == null) lockSinceRef.current = now;
        if (now - lockSinceRef.current >= LOCK_HOLD_MS) setLockedVisual(true);
      } else {
        lockSinceRef.current = null;
        if (lockedVisual) setLockedVisual(false);
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
  }, [lockedVisual]);

  useEffect(() => {
    if (!state.fillerFlashNonce) return;
    setFillerFlashVisible(true);
    if (fillerFadeTimerRef.current !== null) window.clearTimeout(fillerFadeTimerRef.current);
    fillerFadeTimerRef.current = window.setTimeout(() => {
      setFillerFlashVisible(false);
      fillerFadeTimerRef.current = null;
    }, 800);
    return () => {
      if (fillerFadeTimerRef.current !== null) {
        window.clearTimeout(fillerFadeTimerRef.current);
        fillerFadeTimerRef.current = null;
      }
    };
  }, [state.fillerFlashNonce]);

  const ballX = CX + display.x;
  const ballY = CY + display.y;
  const ringColor = audioError ? COLOR.yellow : COLOR[state.coachColor] ?? COLOR.gray;
  const isGreen = !audioError && state.coachColor === "green";
  const isGray = state.coachColor === "gray" || state.silenceGated;
  const isLocked = state.locked || lockedVisual;

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
            r={isLocked ? 22 : isGreen ? 18 : 13}
            fill={ringColor}
            opacity={isLocked ? 0.34 : isGreen ? 0.22 : 0.15}
          >
            {isLocked && (
              <>
                <animate attributeName="r" values="18;26;18" dur="0.9s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.4;0.25" dur="0.9s" repeatCount="indefinite" />
              </>
            )}
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
          {fillerFlashVisible && (
            <circle cx={ballX} cy={ballY} r={17} fill="none" stroke="#FACC15" strokeWidth={2.5} opacity={0.9}>
              <animate attributeName="r" values="12;22" dur="0.8s" fill="freeze" />
              <animate attributeName="opacity" values="0.9;0" dur="0.8s" fill="freeze" />
            </circle>
          )}
          {/* Ball */}
          <circle cx={ballX} cy={ballY} r={9} fill={ringColor} opacity={0.9} />
          <circle cx={ballX} cy={ballY} r={3.5} fill="white" opacity={0.95} />
        </svg>

        {/* Combo badge */}
        {display.combo > 0 ? (
          <div className="absolute top-2 right-2 bg-[#2E9E6F] text-white rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums shadow-sm">
            {display.combo}s
          </div>
        ) : null}
        {fillerFlashVisible ? (
          <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-950 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm animate-pulse">
            filler
          </div>
        ) : null}
        {isLocked ? (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm">
            locked in
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
