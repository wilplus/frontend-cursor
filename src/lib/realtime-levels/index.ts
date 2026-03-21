import type { UserSniperProfile } from "@/lib/sniper/types";
import { LEVEL_1_STEP_1 } from "./level-1/step-1";
import { LEVEL_1_STEP_2 } from "./level-1/step-2";
import type { RealtimeTrainingStep } from "./types";

export const LEVEL_1_STEPS: RealtimeTrainingStep[] = [
  LEVEL_1_STEP_1,
  LEVEL_1_STEP_2,
];

export function resolveRealtimeTrainingStep(
  profile: Pick<
    UserSniperProfile,
    "realtime_level" | "realtime_step" | "realtime_pitch_baseline_st" | "sessions_with_pitch_count"
  > | null | undefined
): RealtimeTrainingStep {
  const hasPitchBaseline =
    typeof profile?.realtime_pitch_baseline_st === "number" &&
    Number.isFinite(profile.realtime_pitch_baseline_st);
  const hasPitchSessions = typeof profile?.sessions_with_pitch_count === "number" && profile.sessions_with_pitch_count > 0;
  if (profile?.realtime_level === 1 && (profile.realtime_step ?? 1) >= 2 && (hasPitchBaseline || hasPitchSessions)) {
    return LEVEL_1_STEP_2;
  }
  if ((hasPitchBaseline || hasPitchSessions) && (profile?.realtime_level == null || profile.realtime_level === 1)) {
    return LEVEL_1_STEP_2;
  }
  return LEVEL_1_STEP_1;
}

export { LEVEL_1_STEP_1, LEVEL_1_STEP_2 };
export type { RealtimeTrainingStep, RealtimeAxisMetric, RealtimeAxisDefinition } from "./types";
