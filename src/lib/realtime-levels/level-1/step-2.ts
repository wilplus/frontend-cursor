import type { RealtimeTrainingStep } from "../types";

export const LEVEL_1_STEP_2: RealtimeTrainingStep = {
  id: "level-1-step-2",
  level: 1,
  step: 2,
  title: "Pitch baseline + pace",
  description:
    "Uses the student's stored pitch baseline on X while keeping the current pace signal on Y. Falls back to center until enough confident pitch frames are available.",
  xAxis: {
    metric: "pitch_baseline",
    label: "Pitch",
    negativeHint: "Lower",
    positiveHint: "Higher",
  },
  yAxis: {
    metric: "pace",
    label: "Pace",
    negativeHint: "Slower",
    positiveHint: "Faster",
  },
};
