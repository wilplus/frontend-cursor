import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * POST /api/v2/internal/journal/image/select
 *
 * BFF passthrough for the Journal CMS cover generator: promote an earlier
 * attempt onto the post's cover. This is the undo for Regenerate, and the
 * retry path when a draw stored its image but failed to attach it.
 *
 * Password-gated on the BACKEND (the admin password rides in the body), so this
 * proxy adds no auth of its own and relays the upstream status + body verbatim.
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
    upstream = await fetch(`${backend}/v2/internal/journal/image/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/internal/journal/image/select — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Journal service unavailable." },
      { status: 502 }
    );
  }

  if ([204, 205, 304].includes(upstream.status)) {
    return new NextResponse(null, { status: upstream.status });
  }
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
