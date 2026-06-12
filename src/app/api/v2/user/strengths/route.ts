import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/strengths
 *
 * BFF proxy for the slide-grouped strong-sides page (§7b, BE PR #76).
 * @require_auth. 200 → { general:[...], trainings:[...] } — strong moments from
 * no-deck sessions + one group per deck-session (each slide carrying the strong
 * snippets delivered on it, sorted by rank). The user's own data — read-only.
 * Separate from /v2/user/library (which the Lounge librarian bot still uses).
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
    upstream = await fetch(`${backend}/v2/user/strengths`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/user/strengths — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Strengths service unavailable." },
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
