/**
 * Abandon the current session so it is no longer "active"; user can start a new session.
 * Proxies POST to /v2/homework/session/:id/abandon. Passes through 4xx/5xx body (e.g. 409 if already completed).
 */
import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "../../../../getAuth";
import { proxyResponse } from "../../../../proxyResponse";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getV2AccessToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = params;
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  const backendUrl = getBackendUrl();
  if (!backendUrl || !backendUrl.trim()) {
    return NextResponse.json(
      { error: "Backend not configured", message: "Cannot abandon session; backend URL is missing." },
      { status: 503 }
    );
  }
  const upstreamRes = await fetch(`${backendUrl}/v2/homework/session/${sessionId}/abandon`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return proxyResponse(upstreamRes);
}
