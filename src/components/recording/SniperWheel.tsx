"use client";

/**
 * Live Coach — Coach Mode.
 * Shows a single Flow bar (Choppy ↔ Good ↔ Rushed) + overall score + coaching cue.
 * Simple, readable, no wheel.
 */

import type { LiveCoachState } from "@/lib/sniper/types";

const COLOR_MAP: Record<string, string> = {
  green: "#2E9E6F",
  yellow: "#D6A23D",
  red: "#C94F4F",
  gray: "#9CA3AF",
};

export interface SniperWheelProps {
  state: LiveCoachState;
  taskLabel?: string;
  audioError?: boolean;
}

export function SniperWheel({ state, taskLabel, audioError = false }: SniperWheelProps) {
  const color = COLOR_MAP[audioError ? "yellow" : state.coachColor] ?? COLOR_MAP.gray;
  const cue = audioError
    ? "Mic signal interrupted — check your audio device."
    : state.coachingCue || "Good flow — hold it.";

  // Flow bar: pauseRatio mapped to 0–100% fill, centered on the good band (0.15–0.30)
  // We display a 3-zone bar: Choppy | Good | Rushed
  // Choppy = pauseRatio > 0.30, Good = 0.15–0.30, Rushed = pauseRatio < 0.15
  const pausePct = Math.round(state.pauseRatio * 100);

  return (
    <div className="w-full flex flex-col items-center pt-1 sm:pt-2 pb-3 sm:pb-4">
      {taskLabel ? (
        <p className="mb-3 text-lg sm:text-xl font-bold leading-snug text-foreground text-center">
          {taskLabel}
        </p>
      ) : null}

      {/* Score */}
      <div className="flex flex-col items-center mb-6">
        <p
          className="text-5xl font-semibold tabular-nums"
          style={{ color }}
        >
          {state.silenceGated ? "—" : `${state.performanceScore}`}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Flow score</p>
      </div>

      {/* Flow bar */}
      <div className="w-full max-w-xs px-2 mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Choppy</span>
          <span>Good</span>
          <span>Rushed</span>
        </div>

        {/* Track */}
        <div className="relative h-3 rounded-full overflow-hidden"
          style={{ background: "linear-gradient(to right, #C94F4F 0%, #D6A23D 20%, #2E9E6F 40%, #2E9E6F 60%, #D6A23D 80%, #C94F4F 100%)" }}>
          {/* Good-zone overlay */}
          <div
            className="absolute inset-y-0"
            style={{
              left: "35%",
              width: "30%",
              background: "rgba(255,255,255,0.15)",
              borderLeft: "1px solid rgba(255,255,255,0.4)",
              borderRight: "1px solid rgba(255,255,255,0.4)",
            }}
          />
          {/* Indicator needle */}
          {!state.silenceGated && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
              style={{
                // Map pauseRatio 0–0.60 → 0–100%
                left: `${Math.min(100, Math.max(0, (state.pauseRatio / 0.60) * 100))}%`,
                transition: "left 0.4s ease",
              }}
            />
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-2">
          {state.silenceGated ? "Speak to start…" : `${pausePct}% pause time`}
        </p>
      </div>

      {/* Coaching strip */}
      <div className="w-full max-w-xs">
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex overflow-hidden">
          <div
            className="w-1 flex-shrink-0 rounded-l-xl"
            style={{ backgroundColor: color }}
          />
          <div className="p-3">
            {audioError ? (
              <p className="text-sm text-[#1F2933] flex items-center gap-1.5">
                <span style={{ color: COLOR_MAP.yellow }} aria-hidden>⚠</span>
                {cue}
              </p>
            ) : (
              <p className="text-sm text-[#1F2933]">{cue}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
