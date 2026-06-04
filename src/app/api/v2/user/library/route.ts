import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/library?tag=
 *
 * BFF proxy for the strong-sides library (§7 / §3.11). @require_auth.
 *   200 → { entries: [ { id, session_id, snippet_id, note, tag, snippet_ref,
 *                        created_at } ], count }
 * The coach's curated, tagged snippets — read-only replay of human-authored
 * notes (never trajectory/profiling). Optional ?tag=strong|to_work_on filter.
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

  const tag = req.nextUrl.searchParams.get("tag");
  const qs = tag ? `?tag=${encodeURIComponent(tag)}` : "";

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/user/library${qs}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/user/library — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Library service unavailable." },
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
