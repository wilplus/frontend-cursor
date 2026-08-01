import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * POST /api/v2/internal/journal/posts/list
 *
 * BFF passthrough for the Journal CMS (every post including drafts, for the CMS list).
 *
 * Password-gated on the BACKEND: the admin password rides in the request body,
 * exactly like the other internal tools, so this proxy adds no auth of its own
 * and requires no Supabase session. It relays the upstream status + body
 * verbatim so the CMS can show 401 (wrong password) and 503 (password not
 * configured) distinctly.
 *
 * The password is never logged.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const body = await req.json().catch(() => ({}));

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/internal/journal/posts/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/internal/journal/posts/list — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Journal service unavailable." },
      { status: 502 }
    );
  }

  // 204/205/304 must not carry a body — NextResponse.json() would throw and
  // turn a successful delete/reorder into a 500. Relay the bare status.
  if ([204, 205, 304].includes(upstream.status)) {
    return new NextResponse(null, { status: upstream.status });
  }
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
