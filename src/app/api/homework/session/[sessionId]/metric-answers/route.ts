/**
 * Legacy proxy for the old metric-answers path.
 * Prefer /task-answers in frontend code; backend still expects /metric-answers.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "../../../../getAuth";
import { proxyResponse } from "../../../../proxyResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (process.env.NODE_ENV !== "test") {
    console.log("BFF legacy metric-answers hit");
  }
  const token = await getV2AccessToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = params;
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const upstreamRes = await fetch(`${getBackendUrl()}/v2/homework/session/${sessionId}/metric-answers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return proxyResponse(upstreamRes);
}
