import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, type Failures, type Relay } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/journal/posts/:slug
 *
 * Client-reachable passthrough to ONE published Journal post. The public post
 * page reads the backend directly (server-side); the Feedback walk opens the
 * signed self-modeling post inside its overlay (build plan D-FW-18, JP1 A), a
 * browser surface that needs a same-origin route it can call without a token
 * (CSP blocks a direct cross-origin fetch).
 *
 * Public by contract: no auth added here, and none required upstream; the
 * backend serves published posts only, so a draft reads as 404. Every failure
 * is a 404 with no body to show: the walk then hides its link rather than
 * open a broken screen.
 */

const GONE = { status: 404, body: { post: null } };
const FALLBACK: Failures = { notConfigured: GONE, unreachable: GONE };
const RELAY: Relay = async (upstream) => {
  if (!upstream.ok) return NextResponse.json({ post: null }, { status: 404 });
  const data = await upstream.json().catch(() => null);
  if (!data) return NextResponse.json({ post: null }, { status: 404 });
  return NextResponse.json(data, { status: 200 });
};

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  return callBackend(`/v2/journal/posts/${encodeURIComponent(params.slug)}`, {
    method: "GET",
    token: null,
    requireAuth: false,
    failures: FALLBACK,
    relay: RELAY,
  });
}
