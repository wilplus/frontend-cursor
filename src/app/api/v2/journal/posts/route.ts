import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * GET /api/v2/journal/posts
 *
 * Client-reachable passthrough to the PUBLIC journal list. The public pages
 * read the backend directly (server-side, ISR), but a browser surface — the
 * coach picking a post to attach to a moment — needs a same-origin route it can
 * call without a token, and CSP would block a direct cross-origin fetch anyway.
 *
 * Public by contract: no auth added here, and none required upstream.
 */
export async function GET(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
  const qs = req.nextUrl.searchParams.toString();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/journal/posts${qs ? `?${qs}` : ""}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
  } catch {
    // A picker with no list is recoverable; a 500 here is not worth breaking
    // the surface that embeds it.
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
  const data = await upstream.json().catch(() => ({ posts: [] }));
  return NextResponse.json(data, { status: 200 });
}
