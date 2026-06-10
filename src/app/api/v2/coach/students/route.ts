import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/students
 *
 * BFF proxy for the coach's student roster (E-1 / E3 / §B.4). Pseudonymized
 * upstream — pseudonym + domain (+ last activity, session count), never the
 * user's real name or email. Coach-gated server-side (require_admin_or_coach);
 * a non-coach gets a 403 which the FE soft-fails to an empty roster.
 *
 * E-1a: this proxy route was MISSING — the roster service (E3) called it and got
 * a 404, which is why "My students" rendered empty. This adds the proxy. Pairs
 * with BE-4 (the upstream endpoint + the coach-gate actually returning rows for
 * the signed-in admin).
 */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/students`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/coach/students — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Students service unavailable." },
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
