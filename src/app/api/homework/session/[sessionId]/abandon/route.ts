/**
 * Abandon the current session so it is no longer "active"; user can start a new session.
 * Proxies POST to /v2/homework/session/:id/abandon. Passes through 4xx/5xx body (e.g. 409 if already completed).
 */
import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "../../../../getAuth";
import { proxyResponse } from "../../../../proxyResponse";

// #region agent log
const INGEST = "http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1";
function log(payload: { location: string; message: string; data?: Record<string, unknown>; hypothesisId?: string }) {
  console.warn("[abandon-debug]", JSON.stringify({ ...payload, timestamp: Date.now() }));
  fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
  }).catch(() => {});
}
// #endregion

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const token = await getV2AccessToken(request);
    const { sessionId } = params;
    const backendUrl = getBackendUrl();
    // #region agent log
    log({
      location: "abandon/route.ts:entry",
      message: "BFF abandon route entered",
      data: { sessionId, hasToken: !!token, backendUrlLength: backendUrl?.length ?? 0 },
      hypothesisId: "H3-H4",
    });
    // #endregion
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    if (!backendUrl || !backendUrl.trim()) {
      console.warn("[abandon-debug] Backend URL not configured");
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
    // #region agent log
    log({
      location: "abandon/route.ts:afterFetch",
      message: "Upstream abandon response",
      data: { upstreamStatus: upstreamRes.status, sessionId },
      hypothesisId: "H1-H5",
    });
    // #endregion
    return proxyResponse(upstreamRes);
  } catch (e) {
    // #region agent log
    log({
      location: "abandon/route.ts:catch",
      message: "BFF abandon route threw",
      data: { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined },
      hypothesisId: "H2-H5",
    });
    // #endregion
    throw e;
  }
}
