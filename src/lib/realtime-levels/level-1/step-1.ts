import type { RealtimeTrainingStep } from "../types";

export const LEVEL_1_STEP_1: RealtimeTrainingStep = {
  id: "level-1-step-1",
  level: 1,
  step: 1,
  title: "Current strength + pace",
  description:
    "Keeps the existing live behavior: X from strength in dB, Y from pace. Pitch telemetry is collected in the background to seed later steps.",
  xAxis: {
    metric: "strength",
    label: "Strength",
    negativeHint: "Quieter",
    positiveHint: "Louder",
  },
  yAxis: {
    metric: "pace",
    label: "Pace",
    negativeHint: "Slower",
    positiveHint: "Faster",
  },
};
