import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";

/**
 * POST /api/v2/user/snippets/[snippetId]/suggestion-feedback
 *
 * BFF proxy — records that the user applied / preferred a Say-It-Stronger
 * suggestion (or applied all) on an instant-view piece (#190). Body:
 * { session_id, target, action, upgrade_index?, suggestion_version }.
 * PUBLIC / guest — auth is forwarded when present; otherwise the signed Guest
 * ID is forwarded. A bare session UUID is never authorization. Status + body
 * are relayed verbatim so the client reads { saved: bool }.
 */

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Feedback service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  const token = await getAccessToken(); // optional — guest-allowed
  const guestOwner = req.headers.get(GUEST_OWNER_HEADER);
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!token && guestOwner) headers[GUEST_OWNER_HEADER] = guestOwner;

  const id = encodeURIComponent(params.snippetId);
  return callBackend(`/v2/user/snippets/${id}/suggestion-feedback`, {
    method: "POST",
    headers,
    body: body || "{}",
    token,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
