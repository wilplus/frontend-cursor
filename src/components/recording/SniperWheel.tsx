"use client";

/**
 * Sniper Wheel — Light theme: premium performance dashboard.
 * Apple Health + Notion + F1 telemetry, minimal. Clean, intelligent, calm.
 */

import type { SniperScores, SniperTier } from "@/lib/sniper/types";
import type { SniperMetricState } from "@/lib/sniper/types";

const VIEWBOX = 360;
const CENTER = 180;
const INNER_R = 50;
const OUTER_R = 115;
const SEGMENTS = 5;
const ANGLE_PER = 360 / SEGMENTS;

const LIGHT = {
  bgPage: "#F7F8FA",
  card: "#FFFFFF",
  primaryText: "#1F2933",
  secondaryText: "#6B7280",
  microLabel: "#9CA3AF",
  border: "#E5E7EB",
  green: "#2E9E6F",
  amber: "#D6A23D",
  red: "#C94F4F",
  greenFill: "rgba(46, 158, 111, 0.15)",
  amberFill: "rgba(214, 162, 61, 0.18)",
  redFill: "rgba(201, 79, 79, 0.15)",
  shadow: "0 4px 20px rgba(0,0,0,0.05)",
} as const;

const TIER_LABELS: Record<SniperTier, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

const SEGMENT_METADATA: Array<{
  key: keyof SniperScores;
  label: string;
  target: string;
}> = [
  { key: "pace", label: "Pace", target: "140–155" },
  { key: "pause", label: "Pause", target: "400–480 ms" },
  { key: "dynamic", label: "Dynamic", target: "12–16 dB" },
  { key: "emphasis", label: "Emphasis", target: "30–40" },
  { key: "energy", label: "Energy", target: "High–Low–High" },
];

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

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

function getScoreColorClass(score: number): string {
  if (score >= 90) return "text-[#2E9E6F]";
  if (score >= 75) return "text-[#1F2933]";
  if (score >= 60) return "text-[#D6A23D]";
  return "text-[#C94F4F]";
}

function getCoachingAccentClass(scores: SniperScores, hasCue: boolean): string {
  if (!hasCue) return "bg-[#2E9E6F]";
  const min = Math.min(
    scores.pace,
    scores.pause,
    scores.dynamic,
    scores.emphasis,
    scores.energy
  );
  if (min < 50) return "bg-[#C94F4F]";
  if (min < 75) return "bg-[#D6A23D]";
  return "bg-[#2E9E6F]";
}

export interface SniperWheelProps {
  scores: SniperScores;
  overallScore: number;
  tier: SniperTier;
  coachingCue: string;
  metrics: SniperMetricState;
  /** Task/prompt text shown in place of "Live Voice Alignment" (same font) */
  taskLabel?: string;
}

export function SniperWheel({
  scores,
  overallScore,
  tier,
  coachingCue,
  metrics,
  taskLabel,
}: SniperWheelProps) {
  const segmentValues = SEGMENT_METADATA.map((meta) => {
    const score = scores[meta.key];
    let value: string;
    if (meta.key === "pace") value = `${metrics.paceWpm} WPM`;
    else if (meta.key === "pause") value = `${metrics.avgPauseMs} ms`;
    else if (meta.key === "dynamic") value = `${metrics.dynamicRangeDb} dB`;
    else if (meta.key === "emphasis") value = `${metrics.emphasisPerMin}/min`;
    else
      value =
        metrics.energyByThird && metrics.energyByThird.e3 >= metrics.energyByThird.e2
          ? "Stable Build"
          : metrics.energyByThird
            ? "Declining"
            : "—";
    return { ...meta, score, value };
  });

  const scoreColorClass = getScoreColorClass(overallScore);
  const coachingAccentClass = getCoachingAccentClass(scores, !!coachingCue);
  const coachingMessage = coachingCue || "Delivery calibrated.";

  return (
    <div
      className="w-full flex flex-col items-center pt-1 sm:pt-2 pb-3 sm:pb-4 bg-transparent"
      role="img"
      aria-label={`Voice alignment ${overallScore}%. ${TIER_LABELS[tier]}. ${coachingMessage}`}
    >
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center">
          {taskLabel ? (
            <div className="mb-2 text-center">
              <p className="text-lg sm:text-xl font-bold leading-snug text-foreground">
                {taskLabel}
              </p>
            </div>
          ) : null}

          <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]">
            <svg
              viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
              className="w-full h-full"
              aria-hidden="true"
            >
              {/* Radial divider lines */}
              {Array.from({ length: SEGMENTS }, (_, i) => {
                const deg = i * ANGLE_PER;
                const pt = polarToCart(CENTER, CENTER, OUTER_R, deg);
                return (
                  <line
                    key={i}
                    x1={CENTER}
                    y1={CENTER}
                    x2={pt.x}
                    y2={pt.y}
                    stroke={LIGHT.border}
                    strokeWidth={1}
                  />
                );
              })}

              {/* Segment wedges: pale fill + thin colored stroke */}
              {segmentValues.map((sv, i) => {
                const startDeg = i * ANGLE_PER;
                const endDeg = (i + 1) * ANGLE_PER;
                const zone = getSegmentZone(sv.score);
                const fillR =
                  INNER_R + (OUTER_R - INNER_R) * (sv.score / 100);
                const pathFill = describeAnnularWedge(
                  CENTER,
                  CENTER,
                  INNER_R,
                  Math.max(INNER_R, fillR),
                  startDeg,
                  endDeg
                );
                const fill =
                  zone === "green"
                    ? LIGHT.greenFill
                    : zone === "amber"
                      ? LIGHT.amberFill
                      : LIGHT.redFill;
                const stroke =
                  zone === "green"
                    ? LIGHT.green
                    : zone === "amber"
                      ? LIGHT.amber
                      : LIGHT.red;
                return (
                  <path
                    key={sv.key}
                    d={pathFill}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* Outer ring stroke */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_R}
                fill="none"
                stroke={LIGHT.border}
                strokeWidth={1}
              />
            </svg>

            {/* Center core: white disc */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="bg-white rounded-full w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] flex flex-col items-center justify-center">
                <p
                  className={`text-3xl sm:text-4xl font-semibold tabular-nums ${scoreColorClass}`}
                >
                  {overallScore}%
                </p>
                <p
                  className="mt-1 text-xs sm:text-sm"
                  style={{ color: LIGHT.secondaryText }}
                >
                  {TIER_LABELS[tier]}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics grid: clear hierarchy */}
          <div className="mt-2 sm:mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 sm:gap-x-8 gap-y-4 sm:gap-y-5 w-full max-w-md">
            {segmentValues.map((sv) => (
              <div key={sv.key} className="flex flex-col">
                <span
                  className="text-xs uppercase tracking-wide"
                  style={{ color: LIGHT.microLabel }}
                >
                  {sv.label}
                </span>
                <span
                  className="text-base font-medium mt-0.5"
                  style={{ color: LIGHT.primaryText }}
                >
                  {sv.value}
                </span>
                <span
                  className="text-xs mt-0.5"
                  style={{ color: LIGHT.secondaryText }}
                >
                  Target: {sv.target}
                </span>
              </div>
            ))}
          </div>

          {/* Coaching strip: left accent + message */}
          <div className="mt-4 sm:mt-5 w-full max-w-2xl">
            <div
              className="bg-white border rounded-xl flex overflow-hidden"
              style={{ borderColor: LIGHT.border }}
            >
              <div
                className={`w-1 flex-shrink-0 rounded-l-xl ${coachingAccentClass}`}
              />
              <div className="p-4">
                <p
                  className="text-sm"
                  style={{ color: LIGHT.primaryText }}
                >
                  {coachingMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
