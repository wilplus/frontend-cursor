"use client";

/**
 * Sniper Game Mode — physics-based center-hold challenge.
 * Spring-physics ball moves based on metric errors.
 * Rings: bullseye (r=24), stability (r=56), outer (r=90).
 * Combo counter tracks seconds held inside bullseye.
 */

import { useRef, useEffect, useState } from "react";
import type { SniperScores, SniperTier } from "@/lib/sniper/types";
import type { SniperMetricState } from "@/lib/sniper/types";
import {
  PACE_IDEAL_WPM,
  PAUSE_IDEAL_MS,
  DYNAMIC_IDEAL_DB,
  EMPHASIS_IDEAL_PER_MIN,
  PITCH_IDEAL_RANGE_ST,
} from "@/lib/sniper/constants";

const VB = 240;
const CX = 120;
const CY = 120;
const R_BULL = 24;
const R_STAB = 56;
const R_OUTER = 90;

const SPRING_K = 0.055;
const DAMPING = 0.84;

const TIER_LABELS: Record<SniperTier, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export interface SniperGameProps {
  scores: SniperScores;
  overallScore: number;
  tier: SniperTier;
  coachingCue: string;
  metrics: SniperMetricState;
  taskLabel?: string;
  audioError?: boolean;
}

// Max trail positions kept (each renders as a fading circle).
const TRAIL_LEN = 7;

export function SniperGame({
  scores,
  overallScore,
  tier,
  coachingCue,
  metrics,
  taskLabel,
  audioError = false,
}: SniperGameProps) {
  const physRef     = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const comboRef    = useRef({ frameCount: 0, count: 0 });
  const targetRef   = useRef({ x: 0, y: 0 });
  const rafRef      = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  // Trail: ring-buffer of last TRAIL_LEN positions (pixel coords relative to center)
  const trailRef    = useRef<Array<{ x: number; y: number }>>([]);
  // Pulse ring tracking
  const pulseRef    = useRef<{ startMs: number; active: boolean }>({ startMs: 0, active: false });
  // Zone / combo change detection
  const prevZoneRef  = useRef<"bull" | "stab" | "outer">("outer");
  const burstKeyRef  = useRef(0);
  const prevComboRef = useRef(0);

  const [display, setDisplay] = useState({
    x: 0,
    y: 0,
    combo: 0,
    zone: "outer" as "bull" | "stab" | "outer",
    trail: [] as Array<{ x: number; y: number }>,
    pulseR: 0,
    pulseOpacity: 0,
    burstKey: 0,
  });

  // Recompute target position whenever metrics change
  useEffect(() => {
    // Signed errors: positive = over ideal, negative = under ideal
    const paceErr = clamp((metrics.paceWpm - PACE_IDEAL_WPM) / 20, -1, 1);
    const pauseErr = clamp((metrics.avgPauseMs - PAUSE_IDEAL_MS) / 300, -1, 1);
    const dynErr = clamp((metrics.dynamicRangeDb - DYNAMIC_IDEAL_DB) / 5, -1, 1);
    const emphErr = clamp((metrics.emphasisPerMin - EMPHASIS_IDEAL_PER_MIN) / 20, -1, 1);
    const pitchErr =
      metrics.pitchRangeSt !== null
        ? clamp((metrics.pitchRangeSt - PITCH_IDEAL_RANGE_ST) / 6, -1, 1)
        : 0;
    const e = metrics.energyByThird;
    const energyDecline =
      e && e.e2 > 1e-8 && e.e3 < e.e2
        ? clamp((e.e2 - e.e3) / (e.e2 + 1e-8), 0, 1)
        : 0;

    // X-axis: pace (fast=right), pause (long=left), pitch (varied=right)
    const tx = (paceErr * 0.45 - pauseErr * 0.3 + pitchErr * 0.25) * R_OUTER;
    // Y-axis: dynamic (flat=up), emphasis (too many=down), energy decline=up
    const ty = (-dynErr * 0.35 + emphErr * 0.35 - energyDecline * 0.3) * R_OUTER;

    targetRef.current = {
      x: clamp(tx, -R_OUTER, R_OUTER),
      y: clamp(ty, -R_OUTER, R_OUTER),
    };
  }, [metrics]);

  // RAF physics loop
  useEffect(() => {
    function tick() {
      const now = performance.now();
      const p   = physRef.current;
      const t   = targetRef.current;

      // Spring step
      p.vx = p.vx * DAMPING + (t.x - p.x) * SPRING_K;
      p.vy = p.vy * DAMPING + (t.y - p.y) * SPRING_K;
      p.x += p.vx;
      p.y += p.vy;

      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      const zone: "bull" | "stab" | "outer" =
        dist <= R_BULL ? "bull" : dist <= R_STAB ? "stab" : "outer";

      // Combo counter
      const c = comboRef.current;
      if (zone === "bull") {
        c.frameCount++;
        c.count = Math.floor(c.frameCount / 60);
      } else if (zone === "outer") {
        c.frameCount = 0;
        c.count = 0;
      }

      // Bullseye entry → trigger pulse ring
      if (zone === "bull" && prevZoneRef.current !== "bull") {
        pulseRef.current = { startMs: now, active: true };
      }
      prevZoneRef.current = zone;

      // Combo milestone burst (every 3 s)
      if (c.count > 0 && c.count !== prevComboRef.current && c.count % 3 === 0) {
        burstKeyRef.current++;
      }
      prevComboRef.current = c.count;

      // Trail
      trailRef.current.push({ x: p.x, y: p.y });
      if (trailRef.current.length > TRAIL_LEN) trailRef.current.shift();

      // Pulse ring radius/opacity derived from time since pulse started
      let pulseR = 0;
      let pulseOpacity = 0;
      const PR = pulseRef.current;
      if (PR.active) {
        const elapsed = now - PR.startMs;
        const dur = 700;
        if (elapsed < dur) {
          const progress   = elapsed / dur;
          pulseR           = R_BULL + R_BULL * 1.6 * progress;
          pulseOpacity     = 0.85 * (1 - progress);
        } else {
          PR.active = false;
        }
      }

      frameCountRef.current++;
      // Render at ~30 fps (every 2 frames)
      if (frameCountRef.current % 2 === 0) {
        setDisplay({
          x: p.x, y: p.y, combo: c.count, zone,
          trail: [...trailRef.current],
          pulseR,
          pulseOpacity,
          burstKey: burstKeyRef.current,
        });
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

  const ringColor =
    display.zone === "bull"
      ? "#2E9E6F"
      : display.zone === "stab"
        ? "#D6A23D"
        : "#C94F4F";

  const cueText = audioError
    ? "Mic signal interrupted — check your audio device."
    : coachingCue || "Delivery calibrated — hold the center.";

  const SCORE_KEYS: (keyof SniperScores)[] = [
    "pace",
    "pause",
    "dynamic",
    "emphasis",
    "energy",
    "pitch",
  ];
  const SCORE_LABELS: Record<keyof SniperScores, string> = {
    pace: "Pace",
    pause: "Pause",
    dynamic: "Dyn",
    emphasis: "Emph",
    energy: "Energy",
    pitch: "Pitch",
  };

  return (
    <div className="w-full flex flex-col items-center pt-1 sm:pt-2 pb-3 sm:pb-4">
      {taskLabel ? (
        <p className="mb-3 text-lg sm:text-xl font-bold leading-snug text-foreground text-center">
          {taskLabel}
        </p>
      ) : null}

      {/* Game arena */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          className="w-[240px] h-[240px] sm:w-[300px] sm:h-[300px]"
          aria-label={`Voice alignment ${overallScore}%. ${TIER_LABELS[tier]}. ${cueText}`}
        >
          {/* Outer ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R_OUTER}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={1.5}
          />
          {/* Stability ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R_STAB}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={1.5}
          />
          {/* Bullseye ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R_BULL}
            fill={
              display.zone === "bull"
                ? "rgba(46,158,111,0.12)"
                : "rgba(229,231,235,0.4)"
            }
            stroke={display.zone === "bull" ? "#2E9E6F" : "#D1D5DB"}
            strokeWidth={1.5}
          />
          {/* Crosshairs */}
          <line
            x1={CX}
            y1={CY - R_OUTER}
            x2={CX}
            y2={CY + R_OUTER}
            stroke="#E5E7EB"
            strokeWidth={0.8}
          />
          <line
            x1={CX - R_OUTER}
            y1={CY}
            x2={CX + R_OUTER}
            y2={CY}
            stroke="#E5E7EB"
            strokeWidth={0.8}
          />
          {/* Ball trail (fading circles behind ball) */}
          {display.trail.map((pt, i) => {
            const opacity = ((i + 1) / display.trail.length) * 0.22;
            const r = 4 + (i / display.trail.length) * 5;
            return (
              <circle
                key={i}
                cx={CX + pt.x}
                cy={CY + pt.y}
                r={r}
                fill={ringColor}
                opacity={opacity}
              />
            );
          })}
          {/* Bullseye pulse ring (expanding on zone entry) */}
          {display.pulseOpacity > 0 && (
            <circle
              cx={CX} cy={CY}
              r={display.pulseR}
              fill="none"
              stroke="#2E9E6F"
              strokeWidth={2}
              opacity={display.pulseOpacity}
            />
          )}
          {/* Ball glow */}
          <circle cx={ballX} cy={ballY} r={13} fill={ringColor} opacity={0.15} />
          {/* Ball */}
          <circle cx={ballX} cy={ballY} r={9} fill={ringColor} opacity={0.9} />
          <circle cx={ballX} cy={ballY} r={3.5} fill="white" opacity={0.95} />
        </svg>

        {/* Score (faint overlay in center) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p
              className="text-2xl font-semibold tabular-nums"
              style={{ color: ringColor, opacity: 0.25 }}
            >
              {overallScore}%
            </p>
          </div>
        </div>

        {/* Combo burst keyframe (re-mount on burstKey change triggers animation) */}
        <style>{`
          @keyframes sniper-burst {
            0%   { transform: scale(0.75); opacity: 0.7; }
            40%  { transform: scale(1.35); opacity: 1;   }
            100% { transform: scale(1);    opacity: 1;   }
          }
        `}</style>
        {/* Combo badge */}
        {display.combo > 0 ? (
          <div
            key={display.burstKey}
            className="absolute top-2 right-2 bg-[#2E9E6F] text-white rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums shadow-sm"
            style={{ animation: "sniper-burst 0.35s ease-out" }}
          >
            {display.combo}s
          </div>
        ) : null}
      </div>

      {/* Coaching strip */}
      <div className="mt-4 w-full max-w-sm">
        <div
          className="bg-white border border-[#E5E7EB] rounded-xl flex overflow-hidden"
        >
          <div
            className="w-1 flex-shrink-0 rounded-l-xl"
            style={{ backgroundColor: audioError ? "#D6A23D" : ringColor }}
          />
          <div className="p-3">
            {audioError ? (
              <p className="text-sm text-[#1F2933] flex items-center gap-1.5">
                <span style={{ color: "#D6A23D" }} aria-hidden>⚠</span>
                {cueText}
              </p>
            ) : (
              <p className="text-sm text-[#1F2933]">{cueText}</p>
            )}
          </div>
        </div>
      </div>

      {/* Metric score pills */}
      <div className="mt-3 flex gap-3 flex-wrap justify-center">
        {SCORE_KEYS.map((k) => {
          const s = scores[k];
          const color =
            s >= 75 ? "#2E9E6F" : s >= 50 ? "#D6A23D" : "#C94F4F";
          return (
            <div key={k} className="flex flex-col items-center min-w-[36px]">
              <span className="text-[10px] uppercase tracking-wide text-[#9CA3AF]">
                {SCORE_LABELS[k]}
              </span>
              <span
                className="text-sm font-medium tabular-nums"
                style={{ color }}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
