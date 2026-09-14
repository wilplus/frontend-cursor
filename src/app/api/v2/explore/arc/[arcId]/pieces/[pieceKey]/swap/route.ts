import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/pieces/[pieceKey]/swap
 *
 * BFF proxy — the discernment decision (accept/reject a pending piece swap).
 * Verbatim relay: the 409s (STALE_SWAP / NOT_PENDING) are first-class
 * outcomes the FE handles with a silent refetch, so status + body pass
 * through untouched.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Swap service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; pieceKey: string } }
) {
  // Sign-in is checked before the body is read, as it always was.
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const arcId = encodeURIComponent(params.arcId);
  const pieceKey = encodeURIComponent(params.pieceKey);
  return callBackend(`/v2/explore/arc/${arcId}/pieces/${pieceKey}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    token,
    failures: FAILURES,
    relay: RELAY,
  });
}
