import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";

/**
 * PUT /api/v2/user/sessions/[sessionId]/transcript-edits
 *
 * BFF proxy — the user's own edit of a readout transcript (a snippet's text, or
 * a deckless full_transcript_chunk by index). Body: { snippet_id | chunk_index,
 * text }. Owner-gated + upserted BE-side; the coach still reviews the original.
 * Forwards status + body faithfully.
 *
 * PUBLIC / guest: a signed-out user's matching Guest ID can persist edits.
 * The session UUID alone is never authorization. Account auth wins when
 * present; otherwise the BFF forwards the signed Guest ID.
 */

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Transcript-edit service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getAccessToken(); // optional — guest-allowed
  const guestOwner = req.headers.get(GUEST_OWNER_HEADER);

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = encodeURIComponent(params.sessionId);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!token && guestOwner) headers[GUEST_OWNER_HEADER] = guestOwner;
  return callBackend(`/v2/user/sessions/${id}/transcript-edits`, {
    method: "PUT",
    headers,
    body,
    token,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
