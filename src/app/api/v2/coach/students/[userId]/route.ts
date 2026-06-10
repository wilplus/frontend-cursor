import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/students/<user_id>
 *
 * BFF proxy for the coach's per-student drill-down (E-1b / S6). Pseudonymized
 * upstream — { pseudonym, domain, goal, sessions[] }, never the user's real
 * name or email (§B.4 / §14 red-line 6). `goal` is the user's free-text and may
 * self-identify (same caveat as transcripts) — that's inherent, not scrubbable.
 * Coach-gated server-side (require_admin_or_coach); 403 → FE soft-fails to null.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

  const uid = encodeURIComponent(params.userId);
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/students/${uid}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/coach/students/[userId] — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Student service unavailable." },
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
