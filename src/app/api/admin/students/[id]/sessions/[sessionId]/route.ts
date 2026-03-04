import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

/**
 * PATCH: Update session (e.g. coach_grade).
 * Proxies to PATCH /v2/admin/students/:userId/sessions/:sessionId
 * Body: { coach_grade: number | null } (1–10 or null to clear).
 * Backend returns 200 with { status: "ok", coach_grade?: number }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const coachGrade = body.coach_grade;
  if (coachGrade !== null && (typeof coachGrade !== "number" || coachGrade < 1 || coachGrade > 10)) {
    return NextResponse.json(
      { error: "coach_grade must be an integer 1–10 or null" },
      { status: 400 }
    );
  }
  const backend = getBackendUrl();
  const url = `${backend}/v2/admin/students/${userId}/sessions/${sessionId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coach_grade: coachGrade }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
