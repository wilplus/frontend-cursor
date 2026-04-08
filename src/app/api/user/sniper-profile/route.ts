import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { copyCookies, proxyJson } from "@/lib/api/bff";
import { applyRealtimeProfileUpdate } from "@/lib/realtime-levels/profile-update";
import { applySniperBaselineUpdate } from "@/lib/sniper/baseline-update";
import {
  MIN_STAGE_SCORE_FOR_BASELINE_UPDATE,
  MIN_VOICED_SEC_FOR_BASELINE_UPDATE,
} from "@/lib/sniper/constants";
import type { SniperSessionMeans } from "@/lib/sniper/types";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const GOOD_RATING_THRESHOLD = 4;

export const dynamic = "force-dynamic";

function createSupabase(req: NextRequest, cookieRes: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieRes.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieRes.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
}

/** GET: proxy to backend GET /user/sniper-profile. Pass-through of backend status and body (200 with {} stays 200, 500 stays 500). */
export async function GET(req: NextRequest) {
  return proxyJson("/user/sniper-profile", undefined, req);
}

/** POST: persist final session summary metrics and optionally update baseline (EMA). */
export async function POST(req: NextRequest) {
  const cookieRes = NextResponse.next();
  const supabase = createSupabase(req, cookieRes);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const out = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    copyCookies(cookieRes, out);
    return out;
  }

  let body: {
    session_means: {
      paceWpm: number | null;
      avgPauseMs: number | null;
      dynamicRangeDb: number | null;
      emphasisPerMin: number | null;
      energyRatio: number | null;
      voicedDurationSec: number;
      pitchCenterSt?: number | null;
      pitchFrameCount?: number | null;
      pitchRangeSt?: number | null;
    };
    stage_score: number;
    voiced_duration_sec: number;
    duration_seconds?: number | null;
    recording_id?: string | null;
    frontend_level?: number | null;
    frontend_step?: number | null;
    completed?: boolean;
    valid_for_progression?: boolean;
    session_id?: string | null;
    student_rating_1_10?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const {
    session_means,
    stage_score,
    voiced_duration_sec,
    duration_seconds,
    recording_id,
    frontend_level,
    frontend_step,
    completed,
    valid_for_progression,
    session_id,
    student_rating_1_10,
  } = body;
  if (
    session_means == null ||
    typeof stage_score !== "number" ||
    typeof voiced_duration_sec !== "number"
  ) {
    return NextResponse.json(
      { error: "session_means, stage_score, voiced_duration_sec required" },
      { status: 400 }
    );
  }

  const qualityOk =
    stage_score >= MIN_STAGE_SCORE_FOR_BASELINE_UPDATE &&
    voiced_duration_sec >= MIN_VOICED_SEC_FOR_BASELINE_UPDATE;
  const normalizedSessionMeans: SniperSessionMeans = {
    paceWpm: session_means.paceWpm ?? 0,
    avgPauseMs: session_means.avgPauseMs ?? 0,
    dynamicRangeDb: session_means.dynamicRangeDb ?? 0,
    emphasisPerMin: session_means.emphasisPerMin ?? 0,
    energyRatio: session_means.energyRatio ?? null,
    voicedDurationSec: session_means.voicedDurationSec,
    pitchCenterSt: session_means.pitchCenterSt ?? null,
    pitchFrameCount: session_means.pitchFrameCount ?? null,
    pitchRangeSt: session_means.pitchRangeSt ?? null,
  };
  const hasCompleteBaselineMetrics =
    session_means.paceWpm != null &&
    session_means.avgPauseMs != null &&
    session_means.dynamicRangeDb != null &&
    session_means.emphasisPerMin != null;

  // Persist to session_sniper_metrics when session_id provided (for later coach rating and student rating)
  if (session_id && typeof session_id === "string") {
    const rating =
      student_rating_1_10 != null && student_rating_1_10 >= 1 && student_rating_1_10 <= 5
        ? student_rating_1_10
        : null;
    const baseMetricsRow = {
      session_id,
      user_id: user.id,
      wpm: session_means.paceWpm,
      pause_ms: session_means.avgPauseMs,
      dynamic_db: session_means.dynamicRangeDb,
      emphasis_per_min: session_means.emphasisPerMin,
      energy_ratio: session_means.energyRatio ?? null,
      pitch_center_st: session_means.pitchCenterSt ?? null,
      pitch_frame_count: session_means.pitchFrameCount ?? null,
      stage_score,
      voiced_duration_sec,
      student_rating_1_10: rating,
    };
    const extendedMetricsRow = {
      ...baseMetricsRow,
      recording_id: typeof recording_id === "string" && recording_id.trim() ? recording_id.trim() : null,
      realtime_level_at_session:
        typeof frontend_level === "number" && Number.isFinite(frontend_level)
          ? Math.round(frontend_level)
          : null,
      realtime_step_at_session:
        typeof frontend_step === "number" && Number.isFinite(frontend_step)
          ? Math.round(frontend_step)
          : null,
    };
    const { error: metricsError } = await supabase
      .from("session_sniper_metrics")
      .upsert(extendedMetricsRow, { onConflict: "session_id" });
    if (
      metricsError &&
      /recording_id|realtime_level_at_session|realtime_step_at_session/i.test(metricsError.message)
    ) {
      await supabase.from("session_sniper_metrics").upsert(baseMetricsRow, {
        onConflict: "session_id",
      });
    }
  }

  // Baseline update: only when (legacy: no session_id) or (session_id + student_rating_1_10 >= 4 on the current 1-5 scale)
  const shouldUpdateBaseline =
    !session_id
      ? qualityOk && hasCompleteBaselineMetrics
      : qualityOk &&
        hasCompleteBaselineMetrics &&
        student_rating_1_10 != null &&
        student_rating_1_10 >= GOOD_RATING_THRESHOLD;

  if (shouldUpdateBaseline) {
    const result = await applySniperBaselineUpdate(
      supabase,
      user.id,
      normalizedSessionMeans,
      qualityOk
    );
    if (result.error) {
      const out = NextResponse.json(
        { error: "Failed to update profile", updated: false },
        { status: 500 }
      );
      copyCookies(cookieRes, out);
      return out;
    }
  }

  const realtimeResult = await applyRealtimeProfileUpdate(
    supabase,
    user.id,
    normalizedSessionMeans,
    voiced_duration_sec
  );
  if (realtimeResult.error) {
    const out = NextResponse.json(
      { error: "Failed to update realtime profile", updated: false },
      { status: 500 }
    );
    copyCookies(cookieRes, out);
    return out;
  }

  // Return current profile (or existing response when no baseline update)
  const { data: profile } = await supabase
    .from("student_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const out = NextResponse.json({
    ...(profile ?? { updated: shouldUpdateBaseline }),
    session_summary: {
      session_id: session_id ?? null,
      recording_id: typeof recording_id === "string" && recording_id.trim() ? recording_id.trim() : null,
      duration_seconds:
        typeof duration_seconds === "number" && Number.isFinite(duration_seconds)
          ? duration_seconds
          : null,
      wpm: session_means.paceWpm,
      voiced_duration_sec,
      measured_pitch_center_st: session_means.pitchCenterSt ?? null,
      pitch_frame_count: session_means.pitchFrameCount ?? null,
      frontend_level:
        typeof frontend_level === "number" && Number.isFinite(frontend_level) ? Math.round(frontend_level) : null,
      frontend_step:
        typeof frontend_step === "number" && Number.isFinite(frontend_step) ? Math.round(frontend_step) : null,
      completed: completed === true,
      valid_for_progression: valid_for_progression === true,
    },
  });
  copyCookies(cookieRes, out);
  return out;
}
