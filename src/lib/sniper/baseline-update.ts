/**
 * Server-only: apply Sniper baseline update (EMA) to user_sniper_profile.
 * Used by sniper-profile POST and by admin grade route when coach grade >= 8.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EMA_ALPHA } from "./constants";
import type { SniperSessionMeans } from "./types";

export async function applySniperBaselineUpdate(
  supabase: SupabaseClient,
  userId: string,
  session_means: SniperSessionMeans,
  qualityOk: boolean
): Promise<{ updated: boolean; error?: string }> {
  if (!qualityOk) {
    return { updated: false };
  }

  const { data: existing } = await supabase
    .from("user_sniper_profile")
    .select("*")
    .eq("user_id", userId)
    .single();

  const alpha = EMA_ALPHA;
  const oneMinusAlpha = 1 - alpha;
  const hadEnergy = session_means.energyRatio != null;

  if (!existing) {
    const { error: insertErr } = await supabase.from("user_sniper_profile").insert({
      user_id: userId,
      session_count: 1,
      sessions_with_energy_count: hadEnergy ? 1 : 0,
      baseline_wpm: session_means.paceWpm,
      baseline_pause_ms: session_means.avgPauseMs,
      baseline_dynamic_db: session_means.dynamicRangeDb,
      baseline_emphasis_per_min: session_means.emphasisPerMin,
      baseline_energy_ratio: session_means.energyRatio ?? null,
    });
    if (insertErr) {
      console.error("[sniper baseline insert]", insertErr.message);
      return { updated: false, error: insertErr.message };
    }
    return { updated: true };
  }

  const prevWpm = existing.baseline_wpm ?? session_means.paceWpm;
  const prevPause = existing.baseline_pause_ms ?? session_means.avgPauseMs;
  const prevDynamic = existing.baseline_dynamic_db ?? session_means.dynamicRangeDb;
  const prevEmphasis = existing.baseline_emphasis_per_min ?? session_means.emphasisPerMin;
  const prevEnergy =
    existing.baseline_energy_ratio ?? session_means.energyRatio ?? 1;

  const newWpm = oneMinusAlpha * prevWpm + alpha * session_means.paceWpm;
  const newPause = oneMinusAlpha * prevPause + alpha * session_means.avgPauseMs;
  const newDynamic = oneMinusAlpha * prevDynamic + alpha * session_means.dynamicRangeDb;
  const newEmphasis =
    oneMinusAlpha * prevEmphasis + alpha * session_means.emphasisPerMin;
  const newEnergy =
    session_means.energyRatio != null
      ? oneMinusAlpha * prevEnergy + alpha * session_means.energyRatio
      : prevEnergy;

  const { error: updateErr } = await supabase
    .from("user_sniper_profile")
    .update({
      session_count: existing.session_count + 1,
      sessions_with_energy_count:
        existing.sessions_with_energy_count + (hadEnergy ? 1 : 0),
      baseline_wpm: newWpm,
      baseline_pause_ms: newPause,
      baseline_dynamic_db: newDynamic,
      baseline_emphasis_per_min: newEmphasis,
      baseline_energy_ratio: newEnergy,
    })
    .eq("user_id", userId);

  if (updateErr) {
    console.error("[sniper baseline update]", updateErr.message);
    return { updated: false, error: updateErr.message };
  }
  return { updated: true };
}
