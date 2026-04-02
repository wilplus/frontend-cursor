import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const backend = getBackendUrl();
  const res = await fetch(`${backend}/v2/admin/students/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // Enrich sessions with sniper_metrics from Supabase if backend didn't include them
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const needsEnrichment = sessions.length > 0 && sessions.some(
    (s: { sniper_metrics?: unknown }) => s.sniper_metrics == null
  );

  if (needsEnrichment) {
    const supabase = createSupabaseAdminClient();
    if (supabase) {
      const sessionIds = sessions.map((s: { id: string }) => s.id).filter(Boolean);
      if (sessionIds.length > 0) {
        const { data: metricsRows } = await supabase
          .from("session_sniper_metrics")
          .select(
            "session_id, wpm, pause_ms, dynamic_db, emphasis_per_min, energy_ratio, voiced_duration_sec, pitch_center_st, pitch_frame_count, stage_score, student_rating_1_10"
          )
          .in("session_id", sessionIds);

        if (metricsRows && metricsRows.length > 0) {
          const metricsMap = new Map(
            metricsRows.map((r: Record<string, unknown>) => [r.session_id, r])
          );
          for (const session of sessions) {
            if (session.sniper_metrics == null) {
              const row = metricsMap.get(session.id) as Record<string, unknown> | undefined;
              if (row) {
                session.sniper_metrics = {
                  wpm: row.wpm ?? null,
                  pause_ms: row.pause_ms ?? null,
                  dynamic_db: row.dynamic_db ?? null,
                  emphasis_per_min: row.emphasis_per_min ?? null,
                  energy_ratio: row.energy_ratio ?? null,
                  voiced_duration_sec: row.voiced_duration_sec ?? null,
                  pitch_center_st: row.pitch_center_st ?? null,
                  pitch_frame_count: row.pitch_frame_count ?? null,
                  stage_score: row.stage_score ?? null,
                  student_rating_1_10: row.student_rating_1_10 ?? null,
                };
              }
            }
          }
        }
      }
    }
  }

  // Pass through backend body as-is (e.g. measured_metrics must not be stripped).
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const backend = getBackendUrl();
  const body = await request.text();
  const res = await fetch(`${backend}/v2/admin/students/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const backend = getBackendUrl();
  const res = await fetch(`${backend}/v2/admin/students/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
