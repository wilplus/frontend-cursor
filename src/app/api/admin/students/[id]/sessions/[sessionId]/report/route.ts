import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

const REPORT_PATH = (userId: string, sessionId: string) =>
  `/v2/admin/students/${userId}/sessions/${sessionId}/report`;

/**
 * GET or POST full report for a student's completed session (admin).
 * Tries GET first; if backend returns 405, tries POST (some backends use POST for report).
 * Response shape: { report_text: string; scores: { warmup, final, overall }; final_recording: { id, audio_url } }
 */
async function handleReport(
  request: NextRequest,
  params: { id: string; sessionId: string },
  method: "GET" | "POST"
): Promise<NextResponse> {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, sessionId } = params;
  const backend = getBackendUrl();
  const url = `${backend}${REPORT_PATH(userId, sessionId)}`;
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(method === "POST" && { body: JSON.stringify({}) }),
  };
  if (method === "POST") {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const resGet = await handleReport(request, params, "GET");
  if (resGet.status === 405) {
    return handleReport(request, params, "POST");
  }
  return resGet;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  return handleReport(request, params, "POST");
}
