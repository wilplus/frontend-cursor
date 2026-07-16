import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * PUT /api/v2/user/sessions/[sessionId]/transcript-edits
 *
 * BFF proxy — the user's own edit of a readout transcript (a snippet's text, or
 * a deckless full_transcript_chunk by index). Body: { snippet_id | chunk_index,
 * text }. Owner-gated + upserted BE-side; the coach still reviews the original.
 * Forwards status + body faithfully.
 *
 * PUBLIC / guest (BE #199): a signed-out user approving a suggestion must
 * persist too — the unclaimed session's own unguessable id is the capability.
 * The token is forwarded when present (signed-in scoping) but never required;
 * the BE remains authoritative on ownership. Same pattern as the Lab upload.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getV2AccessToken(req); // optional — guest-allowed
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = encodeURIComponent(params.sessionId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/user/sessions/${id}/transcript-edits`, {
      method: "PUT",
      headers,
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error("PUT /api/v2/user/sessions/[sessionId]/transcript-edits — fetch failed:", err);
    return NextResponse.json({ error: "Transcript-edit service unavailable." }, { status: 502 });
  }

  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
