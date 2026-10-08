import "server-only";
import { NextResponse } from "next/server";
import { callBackend, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/corpus/clips/[snippetId]/playback
 *   → BE GET /v2/coach/corpus/clips/<snippet_id>/playback
 *
 * How the training corpus plays a queue row (backend PR #920; it replaces
 * the retired MLC-3 source-playback audio stream). The
 * backend answers JSON, not audio:
 *
 *   200 { snippet_id, url, start_offset_ms, duration_ms, expires_in_s }
 *       url is a 15-minute signed URL to the import's PARENT recording, to
 *       be played from start_offset_ms for duration_ms.
 *   400 non-UUID · 401/403 · 404 NOT_FOUND (unknown, or not in an import's
 *   frozen queue) · 409/428 rater-language routing · 410 PHASE2_DISABLED
 *   (switch off) · 503 PLAYBACK_UNAVAILABLE
 *
 * COACH/ADMIN ONLY; the role gate is upstream, so 401/403 pass through as
 * they came. Relayed verbatim apart from the cache header: a signed URL is a
 * credential for fifteen minutes and must never sit in a shared cache.
 * Nothing here is shown to the coach (AC-9, N1): the client hands the URL to
 * the player and the window to its clamp.
 */
const UUID = /^[0-9a-fA-F-]{36}$/;
const RELAY = relayLenient();

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(
  _request: Request,
  context: { params: { snippetId: string } },
) {
  const snippetId = context.params.snippetId;
  if (!UUID.test(snippetId)) {
    return noStore(NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 }));
  }
  return noStore(
    await callBackend(
      `/v2/coach/corpus/clips/${encodeURIComponent(snippetId)}/playback`,
      { method: "GET", relay: RELAY },
    ),
  );
}
