"use client";

/**
 * Biofeedback Mode — coach-focused real-time dashboard.
 * Replaces SniperWheel with:
 *   • 6-axis radar polygon with lerp-smoothed scores
 *   • Metric cards showing raw values + animated progress bars
 *   • Bidirectional live pressure bars (signed deviation from ideal)
 *   • Coaching strip
 *
 * Accepts identical props to SniperWheel so AudioRecorder can swap with one import change.
 */

import { useEffect, useRef, useState } from "react";
import type { SniperScores, SniperTier, SniperMetricState } from "@/lib/sniper/types";
import { computeControlSignals } from "@/lib/sniper/control-signals";

/* ─────────────────────────── constants ──────────────────────────── */

const TIER_LABELS: Record<SniperTier, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

// 6-axis radar – same order as SniperWheel segments
const AXES = [
  { key: "pace",     label: "Pace",   angleDeg: -90 },
  { key: "pause",    label: "Pause",  angleDeg: -30 },
  { key: "dynamic",  label: "Dyn",    angleDeg:  30 },
  { key: "emphasis", label: "Emph",   angleDeg:  90 },
  { key: "energy",   label: "Energy", angleDeg: 150 },
  { key: "pitch",    label: "Pitch",  angleDeg: 210 },
] as const;

const RADAR_CX = 130;
const RADAR_CY = 130;
const RADAR_R  = 88;

const METRIC_DEFS = [
  { key: "pace",     label: "Pace",         target: "140–155 WPM" },
  { key: "pause",    label: "Pause",         target: "400–480 ms"  },
  { key: "dynamic",  label: "Dynamic range", target: "12–16 dB"    },
  { key: "emphasis", label: "Emphasis",      target: "25–45 /min"  },
  { key: "energy",   label: "Energy",        target: "Build arc"   },
  { key: "pitch",    label: "Pitch range",   target: "6–12 st"     },
] as const;

const PRESSURE_DEFS = [
  { key: "pace",     label: "Pace",   negLabel: "Slow",     posLabel: "Fast"       },
  { key: "pause",    label: "Pause",  negLabel: "Few",      posLabel: "Long"       },
  { key: "dynamic",  label: "Dyn",    negLabel: "Flat",     posLabel: "Erratic"    },
  { key: "emphasis", label: "Emph",   negLabel: "Monotone", posLabel: "Over-emph"  },
  { key: "energy",   label: "Energy", negLabel: "Declining",posLabel: "Building"   },
  { key: "pitch",    label: "Pitch",  negLabel: "Monotone", posLabel: "Wide"       },
] as const;

const LIGHT = {
  green:     "#2E9E6F",
  amber:     "#D6A23D",
  red:       "#C94F4F",
  greenFill: "rgba(46,158,111,0.14)",
  amberFill: "rgba(214,162,61,0.14)",
  redFill:   "rgba(201,79,79,0.12)",
  border:    "#E5E7EB",
  text:      "#1F2933",
  muted:     "#6B7280",
  micro:     "#9CA3AF",
} as const;

/* ─────────────────────────── helpers ────────────────────────────── */

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function polar(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function zoneColor(score: number) {
  return score >= 75 ? LIGHT.green : score >= 50 ? LIGHT.amber : LIGHT.red;
}
function zoneFill(score: number) {
  return score >= 75 ? LIGHT.greenFill : score >= 50 ? LIGHT.amberFill : LIGHT.redFill;
}
function zoneLabel(score: number) {
  return score >= 85 ? "Strong" : score >= 70 ? "Workable" : "Focus here";
}

function metricValue(key: string, metrics: SniperMetricState): string {
  if (key === "pace")     return metrics.paceWpm > 0 ? `${metrics.paceWpm} WPM` : "—";
  if (key === "pause")    return metrics.avgPauseMs > 0 ? `${metrics.avgPauseMs} ms` : "—";
  if (key === "dynamic")  return metrics.dynamicRangeDb > 0 ? `${metrics.dynamicRangeDb} dB` : "—";
  if (key === "emphasis") return metrics.emphasisPerMin > 0 ? `${metrics.emphasisPerMin}/min` : "—";
  if (key === "energy") {
    const e = metrics.energyByThird;
    if (!e) return "Warming up";
    return e.e3 >= e.e2 ? "Building ↑" : "Declining ↓";
  }
  return metrics.pitchRangeSt !== null ? `${metrics.pitchRangeSt.toFixed(1)} st` : "—";
}

/* ─────────────────────────── types ──────────────────────────────── */

export interface BiofeedbackModeProps {
  scores: SniperScores;
  overallScore: number;
  tier: SniperTier;
  coachingCue: string;
  metrics: SniperMetricState;
  taskLabel?: string;
  audioError?: boolean;
}

/* ─────────────────────────── radar SVG ──────────────────────────── */

function RadarPolygon({
  displayScores,
  overallScore,
  tier,
}: {
  displayScores: SniperScores;
  overallScore: number;
  tier: SniperTier;
}) {
  const oc = zoneColor(overallScore);
  const of_ = zoneFill(overallScore);

  const polygonPts = AXES.map(({ key, angleDeg }) => {
    const s = displayScores[key as keyof SniperScores];
    const { x, y } = polar(angleDeg, RADAR_R * (s / 100), RADAR_CX, RADAR_CY);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg
      viewBox="0 0 260 260"
      className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px]"
      aria-hidden="true"
    >
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <circle
          key={k}
          cx={RADAR_CX} cy={RADAR_CY}
          r={RADAR_R * k}
          fill="none"
          stroke={LIGHT.border}
          strokeWidth={1}
        />
      ))}

      {/* Axes + labels */}
      {AXES.map(({ key, label, angleDeg }) => {
        const outer = polar(angleDeg, RADAR_R, RADAR_CX, RADAR_CY);
        const lbl   = polar(angleDeg, RADAR_R + 18, RADAR_CX, RADAR_CY);
        return (
          <g key={key}>
            <line
              x1={RADAR_CX} y1={RADAR_CY}
              x2={outer.x}  y2={outer.y}
              stroke={LIGHT.border}
              strokeWidth={1}
            />
            <text
              x={lbl.x} y={lbl.y}
              fontSize="9"
              fill={LIGHT.micro}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Filled polygon */}
      <polygon
        points={polygonPts}
        fill={of_}
        stroke={oc}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Vertex dots */}
      {AXES.map(({ key, angleDeg }) => {
        const s = displayScores[key as keyof SniperScores];
        const { x, y } = polar(angleDeg, RADAR_R * (s / 100), RADAR_CX, RADAR_CY);
        return (
          <circle key={key} cx={x} cy={y} r={3.5} fill={zoneColor(s)} />
        );
      })}

      {/* Center score */}
      <circle cx={RADAR_CX} cy={RADAR_CY} r={30} fill="white" />
      <text
        x={RADAR_CX} y={RADAR_CY - 5}
        fontSize="18"
        fontWeight="700"
        fill={oc}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {Math.round(overallScore)}
      </text>
      <text
        x={RADAR_CX} y={RADAR_CY + 13}
        fontSize="7.5"
        fill={LIGHT.muted}
        textAnchor="middle"
      >
        {TIER_LABELS[tier].split(" ")[0]}
      </text>
    </svg>
  );
}

/* ─────────────────────────── metric card ────────────────────────── */

function MetricCard({
  label,
  value,
  target,
  score,
}: {
  label: string;
  value: string;
  target: string;
  score: number;
}) {
  const color = zoneColor(score);
  return (
    <div className="rounded-xl border bg-white p-3 space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] uppercase tracking-wide" style={{ color: LIGHT.micro }}>
          {label}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
          style={{ color, background: zoneFill(score), borderColor: color + "44" }}
        >
          {Math.round(score)}
        </span>
      </div>
      <p className="text-lg font-semibold tabular-nums leading-none" style={{ color: LIGHT.text }}>
        {value}
      </p>
      <p className="text-[11px]" style={{ color: LIGHT.muted }}>
        {target}
      </p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: LIGHT.border }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, score))}%`,
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── pressure bar ───────────────────────── */

function PressureRow({
  label,
  value,
  negLabel,
  posLabel,
}: {
  label: string;
  value: number;
  negLabel: string;
  posLabel: string;
}) {
  const pct = Math.abs(value) * 50; // 0–50% of half-bar
  const isNeg = value < 0;
  const color = Math.abs(value) > 0.6
    ? LIGHT.red
    : Math.abs(value) > 0.25
      ? LIGHT.amber
      : LIGHT.green;
  const sideLabel = Math.abs(value) < 0.15 ? "Balanced" : isNeg ? negLabel : posLabel;

  return (
    <div className="grid items-center gap-x-2" style={{ gridTemplateColumns: "48px 1fr 68px" }}>
      <span className="text-[11px] tabular-nums" style={{ color: LIGHT.muted }}>{label}</span>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: LIGHT.border }}>
        {/* center tick */}
        <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: LIGHT.micro }} />
        {/* fill */}
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            [isNeg ? "right" : "left"]: "50%",
            width: `${pct}%`,
            background: color,
            transition: "width 400ms ease",
          }}
        />
      </div>
      <span className="text-[10px] text-right tabular-nums" style={{ color }}>
        {sideLabel}
      </span>
    </div>
  );
}

/* ─────────────────────────── main component ─────────────────────── */

export function BiofeedbackMode({
  scores,
  overallScore,
  tier,
  coachingCue,
  metrics,
  taskLabel,
  audioError = false,
}: BiofeedbackModeProps) {
  // Lerp display scores toward incoming scores at ~30 fps
  const [displayScores, setDisplayScores] = useState<SniperScores>(scores);
  const [displayOverall, setDisplayOverall] = useState(overallScore);

  const targetScoresRef  = useRef(scores);
  const targetOverallRef = useRef(overallScore);
  const frameRef         = useRef(0);

  useEffect(() => { targetScoresRef.current  = scores;       }, [scores]);
  useEffect(() => { targetOverallRef.current = overallScore; }, [overallScore]);

  useEffect(() => {
    let raf = 0;
    const T = 0.09; // lerp speed per frame

    const tick = () => {
      frameRef.current++;
      if (frameRef.current % 2 === 0) {
        const tgt = targetScoresRef.current;
        setDisplayScores((prev) => ({
          pace:     lerp(prev.pace,     tgt.pace,     T),
          pause:    lerp(prev.pause,    tgt.pause,    T),
          dynamic:  lerp(prev.dynamic,  tgt.dynamic,  T),
          emphasis: lerp(prev.emphasis, tgt.emphasis, T),
          energy:   lerp(prev.energy,   tgt.energy,   T),
          pitch:    lerp(prev.pitch,    tgt.pitch,    T),
        }));
        setDisplayOverall((prev) => lerp(prev, targetOverallRef.current, T));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const control  = computeControlSignals(metrics);
  const cueText  = coachingCue || "Delivery calibrated.";
  const cueColor =
    Object.values(scores).some((s) => s < 50)  ? LIGHT.red  :
    Object.values(scores).some((s) => s < 75)  ? LIGHT.amber :
    LIGHT.green;

  return (
    <div
      className="w-full flex flex-col items-center pt-1 sm:pt-2 pb-3 sm:pb-4 bg-transparent"
      role="img"
      aria-label={`Voice biofeedback ${Math.round(displayOverall)}%. ${TIER_LABELS[tier]}. ${cueText}`}
    >
      <div className="w-full max-w-4xl flex flex-col items-center gap-3">
        {/* Task label */}
        {taskLabel && (
          <p className="text-lg sm:text-xl font-bold leading-snug text-foreground text-center">
            {taskLabel}
          </p>
        )}

        {/* Radar */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <RadarPolygon
            displayScores={displayScores}
            overallScore={displayOverall}
            tier={tier}
          />
          {/* tier badge */}
          <span
            className="text-xs font-medium px-3 py-1 rounded-full border"
            style={{
              color: zoneColor(displayOverall),
              background: zoneFill(displayOverall),
              borderColor: zoneColor(displayOverall) + "44",
            }}
          >
            {zoneLabel(displayOverall)} · {TIER_LABELS[tier]}
          </span>
        </div>

        {/* Live pressure bars */}
        <div
          className="w-full rounded-xl border bg-white p-3 space-y-2.5"
          style={{ borderColor: LIGHT.border }}
        >
          <p className="text-xs font-medium" style={{ color: LIGHT.muted }}>
            Live pressure signals
          </p>
          {PRESSURE_DEFS.map(({ key, label, negLabel, posLabel }) => (
            <PressureRow
              key={key}
              label={label}
              value={control[key as keyof typeof control]}
              negLabel={negLabel}
              posLabel={posLabel}
            />
          ))}
          <p className="text-[10px]" style={{ color: LIGHT.micro }}>
            Bars show signed deviation from ideal · cards update every 2 s
          </p>
        </div>

        {/* Coaching strip */}
        <div className="w-full">
          {audioError ? (
            <div
              className="bg-white border rounded-xl flex overflow-hidden"
              style={{ borderColor: LIGHT.border }}
            >
              <div className="w-1 flex-shrink-0 rounded-l-xl" style={{ background: LIGHT.amber }} />
              <div className="p-4 flex items-center gap-2">
                <span aria-hidden style={{ color: LIGHT.amber }}>⚠</span>
                <p className="text-sm" style={{ color: LIGHT.text }}>
                  Mic signal interrupted — check your audio device. Scores are paused.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="bg-white border rounded-xl flex overflow-hidden"
              style={{ borderColor: LIGHT.border }}
            >
              <div className="w-1 flex-shrink-0 rounded-l-xl" style={{ background: cueColor }} />
              <div className="p-4">
                <p className="text-sm" style={{ color: LIGHT.text }}>{cueText}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
