import { NextRequest, NextResponse } from "next/server";
import { copyCookies } from "@/lib/api/bff";
import { applySniperBaselineUpdate } from "@/lib/sniper/baseline-update";
import {
  MIN_STAGE_SCORE_FOR_BASELINE_UPDATE,
  MIN_VOICED_SEC_FOR_BASELINE_UPDATE,
} from "@/lib/sniper/constants";
import type { SniperSessionMeans } from "@/lib/sniper/types";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic";

const GOOD_RATING_THRESHOLD = 4;

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

/** PATCH: submit student rating (1–5) for a session. Updates session_sniper_metrics and runs baseline update if rating >= 4. */
export async function PATCH(req: NextRequest) {
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

  let body: { session_id: string; student_rating_1_10: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { session_id, student_rating_1_10 } = body;
  if (
    !session_id ||
    typeof student_rating_1_10 !== "number" ||
    student_rating_1_10 < 1 ||
    student_rating_1_10 > 5
  ) {
    return NextResponse.json(
      { error: "session_id and student_rating_1_10 (1–5) required" },
      { status: 400 }
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("session_sniper_metrics")
    .select("wpm, pause_ms, dynamic_db, emphasis_per_min, energy_ratio, stage_score, voiced_duration_sec")
    .eq("session_id", session_id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: "Session metrics not found for this session" },
      { status: 404 }
    );
  }

  const { error: updateErr } = await supabase
    .from("session_sniper_metrics")
    .update({ student_rating_1_10 })
    .eq("session_id", session_id)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[session-rating PATCH]", updateErr.message);
    return NextResponse.json(
      { error: "Failed to save rating" },
      { status: 500 }
    );
  }

  const qualityOk =
    (row.stage_score ?? 0) >= MIN_STAGE_SCORE_FOR_BASELINE_UPDATE &&
    (row.voiced_duration_sec ?? 0) >= MIN_VOICED_SEC_FOR_BASELINE_UPDATE;

  const sessionMeans: SniperSessionMeans = {
    paceWpm: row.wpm ?? 0,
    avgPauseMs: row.pause_ms ?? 0,
    dynamicRangeDb: row.dynamic_db ?? 0,
    emphasisPerMin: row.emphasis_per_min ?? 0,
    energyRatio: row.energy_ratio ?? null,
    voicedDurationSec: row.voiced_duration_sec ?? 0,
  };

  if (student_rating_1_10 >= GOOD_RATING_THRESHOLD && qualityOk) {
    const result = await applySniperBaselineUpdate(
      supabase,
      user.id,
      sessionMeans,
      true
    );
    if (result.error) {
      // Rating saved; baseline update failed - still 200
      console.error("[session-rating baseline]", result.error);
    }
  }

  const { data: profile } = await supabase
    .from("student_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const out = NextResponse.json({
    saved: true,
    profile: profile ?? null,
  });
  copyCookies(cookieRes, out);
  return out;
}
