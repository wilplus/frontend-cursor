export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "../../../../getAuth";
import { proxyResponse } from "../../../../proxyResponse";

/**
 * Preferred frontend alias for step-2 answers.
 * Backend still uses /metric-answers, so this route proxies there.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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
