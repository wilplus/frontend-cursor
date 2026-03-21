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

const GOOD_RATING_THRESHOLD = 8;

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

/** POST: persist session metrics and optionally update baseline (EMA). Body: session_means, stage_score, voiced_duration_sec; optional session_id, student_rating_1_10. Baseline updates only when rating >= 8 (or when no session_id for legacy). */
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
    session_means: SniperSessionMeans;
    stage_score: number;
    voiced_duration_sec: number;
    session_id?: string | null;
    student_rating_1_10?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { session_means, stage_score, voiced_duration_sec, session_id, student_rating_1_10 } = body;
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

  // Persist to session_sniper_metrics when session_id provided (for later coach rating and student rating)
  if (session_id && typeof session_id === "string") {
    const rating =
      student_rating_1_10 != null && student_rating_1_10 >= 1 && student_rating_1_10 <= 10
        ? student_rating_1_10
        : null;
    await supabase.from("session_sniper_metrics").upsert(
      {
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
      },
      { onConflict: "session_id" }
    );
  }

  // Baseline update: only when (legacy: no session_id) or (session_id + student_rating_1_10 >= 8)
  const shouldUpdateBaseline =
    !session_id
      ? qualityOk
      : qualityOk &&
        student_rating_1_10 != null &&
        student_rating_1_10 >= GOOD_RATING_THRESHOLD;

  if (shouldUpdateBaseline) {
    const result = await applySniperBaselineUpdate(
      supabase,
      user.id,
      session_means,
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
    session_means,
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
    .from("user_sniper_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const out = NextResponse.json(
    profile ?? { updated: shouldUpdateBaseline }
  );
  copyCookies(cookieRes, out);
  return out;
}
