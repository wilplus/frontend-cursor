import type { UserSniperProfile } from "@/lib/sniper/types";
import { LEVEL_1_STEP_1 } from "./level-1/step-1";
import { LEVEL_1_STEP_2 } from "./level-1/step-2";
import type { RealtimeTrainingStep } from "./types";

export const LEVEL_1_STEPS: RealtimeTrainingStep[] = [
  LEVEL_1_STEP_1,
  LEVEL_1_STEP_2,
];

function resolveLevel1StepNumber(stepNumber: number): RealtimeTrainingStep {
  const safeStepNumber = Math.max(1, Math.floor(stepNumber));
  const stepIndex = (safeStepNumber - 1) % LEVEL_1_STEPS.length;
  return LEVEL_1_STEPS[stepIndex] ?? LEVEL_1_STEP_1;
}

export function resolveRealtimeTrainingStep(
  profile: Pick<
    UserSniperProfile,
    "realtime_level" | "realtime_step" | "realtime_pitch_baseline_st" | "sessions_with_pitch_count"
  > | null | undefined
): RealtimeTrainingStep {
  const requestedLevel = profile?.realtime_level ?? 1;
  const requestedStep = profile?.realtime_step ?? 1;
  if (requestedLevel === 1) {
    if (profile?.realtime_step != null) {
      return resolveLevel1StepNumber(requestedStep);
    }
  }
  return LEVEL_1_STEP_1;
}

export { LEVEL_1_STEP_1, LEVEL_1_STEP_2 };
export type { RealtimeTrainingStep, RealtimeAxisMetric, RealtimeAxisDefinition } from "./types";
