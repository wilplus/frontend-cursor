"use client";

/**
 * Sniper Wheel — Elite Performance Coach (Public Speaking).
 * 5 radial segments: Pace, Pause, Dynamic, Emphasis, Energy.
 * Center: Voice Alignment %, tier label, single coaching cue.
 * Restrained, data-driven; no flashing.
 */

import type { SniperScores, SniperTier } from "@/lib/sniper/types";
import type { SniperMetricState } from "@/lib/sniper/types";

const VIEWBOX = 400;
const CENTER = 200;
const INNER_R = 52;
const MID_R = 85;
const OUTER_R = 120;
const SEGMENTS = 5;
const ANGLE_PER = 360 / SEGMENTS;

const COLORS = {
  bg: "#111315",
  green: "#1DBE88",
  amber: "#D9A441",
  red: "#B34E4E",
  text: "#EDEDED",
  subtext: "#8A8F98",
  stroke: "rgba(255,255,255,0.08)",
} as const;

const TIER_LABELS: Record<SniperTier, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

const SEGMENT_LABELS: Array<{ key: keyof SniperScores; label: string }> = [
  { key: "pace", label: "PACE" },
  { key: "pause", label: "PAUSE" },
  { key: "dynamic", label: "DYNAMIC" },
  { key: "emphasis", label: "EMPHASIS" },
  { key: "energy", label: "ENERGY" },
];

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const start = polarToCart(cx, cy, r, startDeg);
  const end = polarToCart(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** Wedge from center to arc at r from startDeg to endDeg (closed path). */
function describeWedge(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const start = polarToCart(cx, cy, r, startDeg);
  const end = polarToCart(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

/** Annular wedge (ring segment) between rInner and rOuter. */
function describeAnnularWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number
): string {
  const startInner = polarToCart(cx, cy, rInner, startDeg);
  const endInner = polarToCart(cx, cy, rInner, endDeg);
  const startOuter = polarToCart(cx, cy, rOuter, startDeg);
  const endOuter = polarToCart(cx, cy, rOuter, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${startInner.x} ${startInner.y} L ${startOuter.x} ${startOuter.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${rInner} ${rInner} 0 ${large} 0 ${startInner.x} ${startInner.y} Z`;
}

function getSegmentZone(score: number): "green" | "amber" | "red" {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export interface SniperWheelProps {
  scores: SniperScores;
  overallScore: number;
  tier: SniperTier;
  coachingCue: string;
  metrics: SniperMetricState;
}

export function SniperWheel({
  scores,
  overallScore,
  tier,
  coachingCue,
  metrics,
}: SniperWheelProps) {
  const segmentValues = [
    { score: scores.pace, value: `${metrics.paceWpm} WPM`, target: "140–155" },
    {
      score: scores.pause,
      value: `${metrics.avgPauseMs} ms`,
      target: "400–480 ms",
    },
    {
      score: scores.dynamic,
      value: `${metrics.dynamicRangeDb} dB`,
      target: "12–16 dB",
    },
    {
      score: scores.emphasis,
      value: `${metrics.emphasisPerMin}/min`,
      target: "30–40",
    },
    {
      score: scores.energy,
      value:
        metrics.energyByThird &&
        metrics.energyByThird.e3 >= metrics.energyByThird.e2
          ? "Stable Build"
          : metrics.energyByThird
            ? "Declining"
            : "—",
      target: "High–Low–High",
    },
  ];

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: COLORS.bg }}
      role="img"
      aria-label={`Voice alignment ${overallScore}%. ${TIER_LABELS[tier]}. ${coachingCue || "Delivery calibrated."}`}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="w-full h-full min-h-[320px]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="sniperGreen"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.25} />
            <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient
            id="sniperAmber"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.2} />
            <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient
            id="sniperRed"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={COLORS.red} stopOpacity={0.15} />
            <stop offset="100%" stopColor={COLORS.red} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        {/* Segment wedges: outline and fill from center by score */}
        {SEGMENT_LABELS.map((seg, i) => {
          const startDeg = i * ANGLE_PER;
          const endDeg = (i + 1) * ANGLE_PER;
          const score = segmentValues[i].score;
          const zone = getSegmentZone(score);
          const fillR = INNER_R + (OUTER_R - INNER_R) * (score / 100);
          const pathOuter = describeWedge(CENTER, CENTER, OUTER_R, startDeg, endDeg);
          const pathFill = describeAnnularWedge(CENTER, CENTER, INNER_R, Math.max(INNER_R, fillR), startDeg, endDeg);
          const fillUrl =
            zone === "green"
              ? "url(#sniperGreen)"
              : zone === "amber"
                ? "url(#sniperAmber)"
                : "url(#sniperRed)";
          return (
            <g key={seg.key}>
              <path
                d={pathOuter}
                fill="none"
                stroke={COLORS.stroke}
                strokeWidth={1.5}
              />
              <path
                d={pathFill}
                fill={fillUrl}
                stroke={zone === "green" ? COLORS.green : zone === "amber" ? COLORS.amber : COLORS.red}
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* Center circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R - 4}
          fill={COLORS.bg}
          stroke={COLORS.stroke}
          strokeWidth={1}
        />

        {/* Segment labels at outer edge */}
        {SEGMENT_LABELS.map((seg, i) => {
          const midDeg = (i + 0.5) * ANGLE_PER;
          const pt = polarToCart(CENTER, CENTER, OUTER_R + 18, midDeg);
          return (
            <text
              key={seg.key}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={COLORS.subtext}
              fontSize={10}
              fontWeight={600}
              className="uppercase"
            >
              {seg.label}
            </text>
          );
        })}
      </svg>

      {/* Center content overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ paddingTop: "0.5rem" }}
      >
        <p
          className="text-[10px] uppercase tracking-wider font-medium"
          style={{ color: COLORS.subtext }}
        >
          Live voice alignment
        </p>
        <p
          className="text-4xl sm:text-5xl font-semibold tabular-nums mt-0.5"
          style={{ color: COLORS.text }}
        >
          {overallScore}%
        </p>
        <p
          className="text-xs font-medium mt-0.5"
          style={{ color: COLORS.subtext }}
        >
          {TIER_LABELS[tier]}
        </p>
        {coachingCue ? (
          <p
            className="text-xs max-w-[72%] text-center mt-2 px-2"
            style={{ color: COLORS.amber }}
          >
            {coachingCue}
          </p>
        ) : (
          <p
            className="text-xs mt-2"
            style={{ color: COLORS.subtext }}
          >
            Delivery calibrated.
          </p>
        )}
      </div>

      {/* Live values under wheel (compact) */}
      <div
        className="grid grid-cols-5 gap-1 px-2 pb-3 pt-1 text-center"
        style={{ color: COLORS.subtext }}
      >
        {segmentValues.map((sv, i) => (
          <div key={i} className="text-[10px]">
            <div className="font-mono font-medium" style={{ color: COLORS.text }}>
              {sv.value}
            </div>
            <div className="opacity-75">Target: {sv.target}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
