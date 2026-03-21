import type { SupabaseClient } from "@supabase/supabase-js";
import type { SniperSessionMeans } from "@/lib/sniper/types";

const PITCH_BASELINE_EMA_ALPHA = 0.35;
const MIN_VOICED_SEC_FOR_PITCH_BASELINE = 20;
const MIN_PITCH_FRAMES_FOR_BASELINE = 12;

export async function applyRealtimeProfileUpdate(
  supabase: SupabaseClient,
  userId: string,
  sessionMeans: SniperSessionMeans,
  voicedDurationSec: number
): Promise<{ updated: boolean; error?: string }> {
  const pitchCenterSt = sessionMeans.pitchCenterSt;
  const pitchFrameCount = sessionMeans.pitchFrameCount ?? 0;
  if (
    typeof pitchCenterSt !== "number" ||
    !Number.isFinite(pitchCenterSt) ||
    voicedDurationSec < MIN_VOICED_SEC_FOR_PITCH_BASELINE ||
    pitchFrameCount < MIN_PITCH_FRAMES_FOR_BASELINE
  ) {
    return { updated: false };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("user_sniper_profile")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (fetchErr && fetchErr.code !== "PGRST116") {
    return { updated: false, error: fetchErr.message };
  }

  if (!existing) {
    const { error: insertErr } = await supabase.from("user_sniper_profile").insert({
      user_id: userId,
      realtime_level: 1,
      realtime_step: 2,
      sessions_with_pitch_count: 1,
      realtime_pitch_baseline_st: pitchCenterSt,
    });
    if (insertErr) return { updated: false, error: insertErr.message };
    return { updated: true };
  }

  const prevPitchBaseline =
    typeof existing.realtime_pitch_baseline_st === "number" &&
    Number.isFinite(existing.realtime_pitch_baseline_st)
      ? existing.realtime_pitch_baseline_st
      : pitchCenterSt;
  const nextPitchBaseline =
    (1 - PITCH_BASELINE_EMA_ALPHA) * prevPitchBaseline +
    PITCH_BASELINE_EMA_ALPHA * pitchCenterSt;

  const { error: updateErr } = await supabase
    .from("user_sniper_profile")
    .update({
      realtime_level: existing.realtime_level ?? 1,
      realtime_step: Math.max(existing.realtime_step ?? 1, 2),
      sessions_with_pitch_count: (existing.sessions_with_pitch_count ?? 0) + 1,
      realtime_pitch_baseline_st: nextPitchBaseline,
    })
    .eq("user_id", userId);

  if (updateErr) return { updated: false, error: updateErr.message };
  return { updated: true };
}
