import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/results/[sessionId]/status
 *
 * Dual-state status for a specific session — "completed" once admin
 * publishes results, "processing" otherwise.
 *
 * Auth: bearer token. User can only view their own session.
 *
 * Why we proxy through the backend instead of querying Supabase
 * directly: v2_sessions has RLS enabled with NO permissive policies for
 * anon/authenticated roles (see migrations/enable_rls_public_tables.sql).
 * The Flask backend uses the service-role key and bypasses RLS, so going
 * through it is the only way the user actually sees their own row.
 *
 * Previous version queried supabase.from("v2_sessions") directly and
 * always 404'd on freshly-claimed sessions ("Session not found." screen
 * after signup) because RLS hid the row from the anon client.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Sign-in required." },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.sessionId);

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/v2/user/results/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/results/[id]/status — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Status service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        code: "UPSTREAM_NON_JSON",
        error: `Unexpected backend response (HTTP ${upstream.status}).`,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }

  // Pass through error responses verbatim — the page already handles
  // 401/403/404 distinctly.
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  // Project the backend's full results payload down to the status-only
  // fields the page expects. Snippets are returned via the sibling
  // /snippets endpoint to keep the two concerns separable.
  return NextResponse.json(
    {
      status: data.status ?? "processing",
      session_id: data.session_id ?? params.sessionId,
      created_at: data.created_at ?? null,
      ai_summary: data.ai_summary ?? null,
      ai_score: data.ai_score ?? null,
      kpi_score: data.kpi_score ?? null,
    },
    { status: 200 }
  );
}
