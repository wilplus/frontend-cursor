import example from "./example_analyze_take_v0.1.json";
import type { AnalyzeDocument, AnalyzeStep, AnalyzeTake, Intervention } from "./types";

/* The shipped example is the mock. Screens never invent a second shape.
   score_if_unlocked stays in the file and is not read here. */

export const EXAMPLE_ANALYSIS = example as unknown as AnalyzeDocument;

export function exampleTakes(): AnalyzeTake[] {
  return EXAMPLE_ANALYSIS.takes;
}

/** The take whose gate is this step. The shipped file gates one take on engagement. */
export function takeWithGate(step: AnalyzeStep): AnalyzeTake {
  const found = EXAMPLE_ANALYSIS.takes.find((take) => take.gate?.step === step);
  if (!found) throw new Error(`No example take is gated on ${step}.`);
  return found;
}

/** Every step in this take has unlocked: true. */
export function takeAllUnlocked(): AnalyzeTake {
  const found = EXAMPLE_ANALYSIS.takes.find((take) => (
    take.order.every((step) => take.summary[step].unlocked)
  ));
  if (!found) throw new Error("No example take has every step unlocked.");
  return found;
}

export function readingFor(kind: "gate" | "open"): AnalyzeTake {
  return kind === "open" ? takeAllUnlocked() : takeWithGate("engagement");
}

/** Starter rules the host can change. They name cues on the real grid. */
export function seedInterventions(): Intervention[] {
  return [
    {
      id: "slow-open",
      name: "Slow the first line",
      threshold: 1,
      rule: { step: "engagement" },
      grid: [
        { step: "engagement", cue: "loudness", value: -0.9 },
        { step: "engagement", cue: "voiced_ratio", value: -0.8 },
      ],
    },
    {
      id: "short-pause",
      name: "Leave a short pause",
      threshold: 1,
      rule: { step: "engagement" },
      grid: [{ step: "engagement", cue: "speech_activity_rate", value: -0.7 }],
    },
    {
      id: "point-page",
      name: "Point at the page",
      threshold: 1,
      rule: { step: "clarity" },
      grid: [{ step: "clarity", cue: "semantic_similarity", value: 0.9 }],
    },
  ];
}
