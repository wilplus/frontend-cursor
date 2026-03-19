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

function wpmColor(wpm: number): string {
  if (wpm >= 115 && wpm <= 170) return COLOR_MAP.green;
  if (wpm >= 100 && wpm < 115) return COLOR_MAP.yellow;
  if (wpm > 170 && wpm <= 190) return COLOR_MAP.yellow;
  return COLOR_MAP.red;
}

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

  // Flow bar: pauseRatio mapped to 0–100% fill, centered on the good band (0.10–0.35)
  // We display a 3-zone bar: Rushed | Good | Choppy
  // Choppy = pauseRatio > 0.35, Good = 0.10–0.35, Rushed = pauseRatio < 0.10
  const pausePct = Math.round(state.pauseRatio * 100);

  return (
    <div className="w-full flex flex-col items-center py-2">
      {taskLabel ? (
        <p className="mb-2 text-lg sm:text-xl font-bold leading-snug text-foreground text-center px-2">
          {taskLabel}
        </p>
      ) : null}

      {/* Score + WPM row */}
      <div className="flex items-end justify-center gap-6 mb-4">
        <div className="flex flex-col items-center">
          <p
            className="text-7xl font-semibold tabular-nums"
            style={{ color }}
          >
            {state.silenceGated ? "—" : `${state.performanceScore}`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Score</p>
        </div>
        {!state.silenceGated && (
          <div className="flex flex-col items-center pb-1">
            <p
              className="text-3xl font-semibold tabular-nums"
              style={{ color: state.wpm !== null ? wpmColor(state.wpm) : COLOR_MAP.gray }}
            >
              {state.wpm !== null ? Math.round(state.wpm) : "…"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">WPM</p>
          </div>
        )}
      </div>

      {/* Flow bar — left = Rushed (low pauseRatio), right = Choppy (high pauseRatio) */}
      <div className="w-full max-w-sm px-4 mb-5">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Rushed</span>
          <span>Good</span>
          <span>Choppy</span>
        </div>

        {/* Track — needle maps 0→0.45 to 0→100% so good band (0.10–0.35) lands at ~22–78% */}
        <div className="relative h-4 rounded-full overflow-hidden"
          style={{ background: "linear-gradient(to right, #C94F4F 0%, #D6A23D 20%, #2E9E6F 40%, #2E9E6F 60%, #D6A23D 80%, #C94F4F 100%)" }}>
          {/* Good-zone overlay at 22–78% */}
          <div
            className="absolute inset-y-0"
            style={{
              left: "22%",
              width: "56%",
              background: "rgba(255,255,255,0.15)",
              borderLeft: "1px solid rgba(255,255,255,0.4)",
              borderRight: "1px solid rgba(255,255,255,0.4)",
            }}
          />
          {/* Indicator needle */}
          {!state.silenceGated && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-sm rounded-full"
              style={{
                // pauseRatio 0 (no pauses = rushed) → left, 0.45+ (very choppy) → right
                left: `${Math.min(100, Math.max(0, (state.pauseRatio / 0.45) * 100))}%`,
                transition: "left 0.4s ease",
              }}
            />
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-2">
          {state.silenceGated ? "Speak to start…" : `${pausePct}% pauses`}
        </p>
      </div>

      {/* Coaching strip */}
      <div className="w-full px-1">
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex overflow-hidden">
          <div
            className="w-1.5 flex-shrink-0 rounded-l-xl"
            style={{ backgroundColor: color }}
          />
          <div className="p-4">
            {audioError ? (
              <p className="text-base text-[#1F2933] flex items-center gap-1.5">
                <span style={{ color: COLOR_MAP.yellow }} aria-hidden>⚠</span>
                {cue}
              </p>
            ) : (
              <p className="text-base text-[#1F2933]">{cue}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
