import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import { applySniperBaselineUpdate } from "@/lib/sniper/baseline-update";
import {
  MIN_STAGE_SCORE_FOR_BASELINE_UPDATE,
  MIN_VOICED_SEC_FOR_BASELINE_UPDATE,
} from "@/lib/sniper/constants";
import type { SniperSessionMeans } from "@/lib/sniper/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const GOOD_RATING_THRESHOLD = 8;

/**
 * PUT: Set admin grade (1–10) for a session.
 * Proxies to backend PUT /v2/admin/students/:id/sessions/:sessionId/grade
 * Body: { admin_grade: number } (1–10).
 * When grade >= 8, also runs Sniper baseline update from session_sniper_metrics for this session.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const grade = typeof body.admin_grade === "number" ? body.admin_grade : undefined;
  if (grade == null || grade < 1 || grade > 10) {
    return NextResponse.json(
      { error: "admin_grade must be a number between 1 and 10" },
      { status: 400 }
    );
  }
  const backend = getBackendUrl();
  const url = `${backend}/v2/admin/students/${userId}/sessions/${sessionId}/grade`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ admin_grade: grade }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // When coach grades >= 8, update Sniper baseline from this session's stored metrics
  if (grade >= GOOD_RATING_THRESHOLD) {
    const supabase = createSupabaseAdminClient();
    if (supabase) {
      const { data: row } = await supabase
        .from("session_sniper_metrics")
        .select("wpm, pause_ms, dynamic_db, emphasis_per_min, energy_ratio, stage_score, voiced_duration_sec")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .single();

      if (row) {
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
        await applySniperBaselineUpdate(supabase, userId, sessionMeans, qualityOk);
      }
    }
  }

  return NextResponse.json(data);
}
