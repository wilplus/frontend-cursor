import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const maxDuration = 30;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * GET /api/results/state
 *
 * Lightweight 3-way routing decision for post-auth flows
 * (SignupForm / LoginForm / /results overview):
 *
 *   { kind: "no_session" }                            → /chat
 *   { kind: "processing", session_id: string }        → /results
 *   { kind: "completed",  session_id: string }        → /results/[id]
 *
 * Routed through the Flask backend's GET /v2/user/sessions/current
 * (which uses the service-role key and bypasses RLS) and reduced to the
 * 3-way enum the callers actually need.
 *
 * The previous version queried supabase.from("v2_sessions") directly,
 * which silently always returned no_session because RLS denies all
 * SELECTs to the authenticated role on v2_sessions (see
 * migrations/enable_rls_public_tables.sql).
 */
export async function GET(req: NextRequest) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
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

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/v2/user/sessions/current`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/results/state — fetch failed:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Failed to read session state" },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { code: "ERROR", error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { code: "ERROR", error: "Failed to read session state" },
      { status: upstream.status }
    );
  }

  // Map the backend's richer status enum down to the three branches the
  // routing callers care about. Anything in flight (processing,
  // pending_review, error) becomes the "processing" branch — they all
  // land on /results, which renders the founder-video waiting screen.
  const hasSession = Boolean(data.has_session);
  const sessionId = (data.session_id as string) || null;
  const status = (data.status as string) || "no_session";

  if (!hasSession || status === "no_session") {
    return NextResponse.json({ kind: "no_session" }, { status: 200 });
  }
  if (status === "completed" && sessionId) {
    return NextResponse.json(
      { kind: "completed", session_id: sessionId },
      { status: 200 }
    );
  }
  // processing / pending_review / error all map to "processing" for the
  // 3-way routing enum. The frontend processing screen is identical for
  // all three.
  return NextResponse.json(
    { kind: "processing", session_id: sessionId ?? "" },
    { status: 200 }
  );
}
