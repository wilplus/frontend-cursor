import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, type Failures, type Relay } from "@/app/api/_lib/backend";

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

// A picker with no list is recoverable; a 500 here is not worth breaking
// the surface that embeds it — every failure is an empty list.
const FALLBACK: Failures = {
  notConfigured: { status: 200, body: { posts: [] } },
  unreachable: { status: 200, body: { posts: [] } },
};
const RELAY: Relay = async (upstream) => {
  if (!upstream.ok) {
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
  const data = await upstream.json().catch(() => ({ posts: [] }));
  return NextResponse.json(data, { status: 200 });
};

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return callBackend(`/v2/journal/posts${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token: null,
    requireAuth: false,
    failures: FALLBACK,
    relay: RELAY,
  });
}
