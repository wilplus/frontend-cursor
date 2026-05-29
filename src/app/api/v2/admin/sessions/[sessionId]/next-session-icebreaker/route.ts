import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET / PUT /api/v2/admin/sessions/[sessionId]/next-session-icebreaker
 *
 * BFF proxy for Task 10 — the AI-prefilled "next session opener"
 * (split-sinks pattern, mirrors /kpi-narrative). Verbatim pass-through
 * so the backend's status envelopes reach the admin card unchanged:
 *
 *   GET  200  { session_id, ai_draft, ai_draft_generated_at, current,
 *               edited_by_admin, edited_at, queue_status, next_session_id,
 *               generation_error }
 *        404  session not found / owner mismatch (no existence leak)
 *        409  ICEBREAKER_NOT_READY — session not finalized yet
 *
 *   PUT  body { question: string }   ("" after trim = skip → queue_status
 *               'skipped'; non-empty must be 5–280 chars + end with '?')
 *        200  echoes the GET shape
 *        422  INVALID_INPUT
 *
 * @require_admin is enforced backend-side.
 */
const upstreamPath = (sessionId: string) =>
  `/v2/admin/sessions/${encodeURIComponent(sessionId)}/next-session-icebreaker`;

async function proxy(
  req: NextRequest,
  sessionId: string,
  method: "GET" | "PUT",
  body?: string
) {
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

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}${upstreamPath(sessionId)}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body != null ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      `${method} /api/v2/admin/sessions/[id]/next-session-icebreaker — fetch failed:`,
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Opener service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          code: "UPSTREAM_NON_JSON",
          error: `Unexpected backend response (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  return proxy(req, params.sessionId, "GET");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const body = await req.text();
  return proxy(req, params.sessionId, "PUT", body || "{}");
}
