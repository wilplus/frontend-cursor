import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/admin/users/[userId]/timeline?session_id=UUID
 * Fetch structured interview timeline: chronological [BotQ] → [UserAudio] → [Metrics].
 * Includes session-level ai_summary, global metrics, and KPI.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Forward query params (session_id filter)
    const sessionId = req.nextUrl.searchParams.get("session_id") || "";
    const qs = sessionId ? `?session_id=${sessionId}` : "";

    const response = await fetch(
      `${backend}/v2/admin/users/${userId}/timeline${qs}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json().catch(() => ({}));

    // Reshape for frontend consumption: add ai_summary and interview_turns alias
    if (response.ok && data.timeline) {
      data.interview_turns = data.timeline;
      data.ai_summary = data.session?.ai_task_alignment_comment || null;
      data.ai_score = data.session?.ai_task_alignment_score || null;
      data.kpi_score = data.session?.kpi_score || null;
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("User timeline API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
