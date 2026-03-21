import type { RealtimeTrainingStep } from "../types";

export const LEVEL_1_STEP_1: RealtimeTrainingStep = {
  id: "level-1-step-1",
  level: 1,
  step: 1,
  title: "Current strength + pace",
  description:
    "Keeps the existing live behavior: X from strength in dB, Y from pace. Pitch telemetry is collected in the background to seed later steps.",
  visualId: "realtime-dartboard",
  xAxis: {
    metric: "strength",
    label: "Weak - Strong",
    negativeHint: "Weak",
    positiveHint: "Strong",
  },
  yAxis: {
    metric: "pace",
    label: "Slow - Fast",
    negativeHint: "Slow",
    positiveHint: "Fast",
  },
};
