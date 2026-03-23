import type { RealtimeTrainingStep } from "../types";

export const LEVEL_1_STEP_2: RealtimeTrainingStep = {
  id: "level-1-step-2",
  level: 1,
  step: 2,
  title: "Pitch baseline + pace",
  description:
    "Uses the student's stored pitch baseline on X while keeping the current pace signal on Y. Falls back to center until enough confident pitch frames are available.",
  visualId: "realtime-dartboard",
  xAxis: {
    metric: "pitch_baseline",
    label: "High - Low",
    negativeHint: "Too high",
    positiveHint: "Too low",
  },
  yAxis: {
    metric: "pace",
    label: "Slow - Fast",
    negativeHint: "Too slow",
    positiveHint: "Too fast",
  },
};
