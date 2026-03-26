/**
 * Sniper profile helpers for the homework flow.
 * Extracted from HomeworkFlowCard.tsx.
 */
import type { HomeworkReportResponse, HomeworkSessionStatus, HomeworkResponse } from "@/lib/api/types-homework";
import type { UserSniperProfile } from "@/lib/sniper/types";

export function getSniperProfileFromReport(
  report: HomeworkReportResponse,
  existingProfile: UserSniperProfile | null
): UserSniperProfile | null {
  const nestedProfile = report.sniper_profile;
  const realtimeLevel =
    report.realtime_level ?? nestedProfile?.realtime_level ?? existingProfile?.realtime_level ?? null;
  const realtimeStep =
    report.realtime_step ?? nestedProfile?.realtime_step ?? existingProfile?.realtime_step ?? null;
  const realtimePitchBaselineSt =
    nestedProfile?.realtime_pitch_baseline_st ?? existingProfile?.realtime_pitch_baseline_st ?? null;
  const sessionsWithPitchCount =
    nestedProfile?.sessions_with_pitch_count ?? existingProfile?.sessions_with_pitch_count;

  if (
    realtimeLevel == null &&
    realtimeStep == null &&
    realtimePitchBaselineSt == null &&
    sessionsWithPitchCount == null &&
    !nestedProfile?.user_id &&
    !existingProfile
  ) {
    return null;
  }

  return {
    user_id: nestedProfile?.user_id ?? existingProfile?.user_id ?? "unknown",
    session_count: existingProfile?.session_count ?? 0,
    sessions_with_energy_count: existingProfile?.sessions_with_energy_count ?? 0,
    sessions_with_pitch_count: sessionsWithPitchCount,
    baseline_wpm: existingProfile?.baseline_wpm ?? null,
    baseline_pause_ms: existingProfile?.baseline_pause_ms ?? null,
    baseline_dynamic_db: existingProfile?.baseline_dynamic_db ?? null,
    baseline_emphasis_per_min: existingProfile?.baseline_emphasis_per_min ?? null,
    baseline_energy_ratio: existingProfile?.baseline_energy_ratio ?? null,
    realtime_level: realtimeLevel ?? undefined,
    realtime_step: realtimeStep ?? undefined,
    realtime_pitch_baseline_st: realtimePitchBaselineSt,
    baseline_pitch_range_st: existingProfile?.baseline_pitch_range_st ?? null,
    baseline_fatigue_sec: existingProfile?.baseline_fatigue_sec ?? null,
    created_at: existingProfile?.created_at ?? "",
    updated_at: nestedProfile?.updated_at ?? existingProfile?.updated_at ?? "",
  };
}

export function getSniperProfileFromStatusPayload(
  status:
    | HomeworkSessionStatus
    | HomeworkResponse
    | null
    | undefined,
  existingProfile: UserSniperProfile | null
): UserSniperProfile | null {
  const nestedProfile = status?.sniper_profile;
  const realtimeLevel =
    status?.realtime_level ?? nestedProfile?.realtime_level ?? existingProfile?.realtime_level ?? null;
  const realtimeStep =
    status?.realtime_step ?? nestedProfile?.realtime_step ?? existingProfile?.realtime_step ?? null;
  const realtimePitchBaselineSt =
    nestedProfile?.realtime_pitch_baseline_st ?? existingProfile?.realtime_pitch_baseline_st ?? null;
  const sessionsWithPitchCount =
    nestedProfile?.sessions_with_pitch_count ?? existingProfile?.sessions_with_pitch_count;

  if (
    realtimeLevel == null &&
    realtimeStep == null &&
    realtimePitchBaselineSt == null &&
    sessionsWithPitchCount == null &&
    !nestedProfile?.user_id &&
    !existingProfile
  ) {
    return null;
  }

  return {
    user_id: nestedProfile?.user_id ?? existingProfile?.user_id ?? "unknown",
    session_count: existingProfile?.session_count ?? 0,
    sessions_with_energy_count: existingProfile?.sessions_with_energy_count ?? 0,
    sessions_with_pitch_count: sessionsWithPitchCount,
    baseline_wpm: existingProfile?.baseline_wpm ?? null,
    baseline_pause_ms: existingProfile?.baseline_pause_ms ?? null,
    baseline_dynamic_db: existingProfile?.baseline_dynamic_db ?? null,
    baseline_emphasis_per_min: existingProfile?.baseline_emphasis_per_min ?? null,
    baseline_energy_ratio: existingProfile?.baseline_energy_ratio ?? null,
    realtime_level: realtimeLevel ?? undefined,
    realtime_step: realtimeStep ?? undefined,
    realtime_pitch_baseline_st: realtimePitchBaselineSt,
    baseline_pitch_range_st: existingProfile?.baseline_pitch_range_st ?? null,
    baseline_fatigue_sec: existingProfile?.baseline_fatigue_sec ?? null,
    created_at: existingProfile?.created_at ?? "",
    updated_at: nestedProfile?.updated_at ?? existingProfile?.updated_at ?? "",
  };
}
