import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

/**
 * GET full report for a student's completed session (admin).
 * Returns report_text, scores, final_recording with audio_url for the admin report modal.
 * Backend contract: GET /v2/admin/students/:userId/sessions/:sessionId/report
 * Response shape: { report_text: string; scores: { warmup, final, overall }; final_recording: { id, audio_url } }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, sessionId } = await params;
  const backend = getBackendUrl();
  const res = await fetch(
    `${backend}/v2/admin/students/${userId}/sessions/${sessionId}/report`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
