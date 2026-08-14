import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/voice-album
 *
 * BFF proxy (BE PR #431) — the arc's Voice Album: moments where the
 * acoustic read, the user, and the coach all agreed (mirror of current
 * alignment). Data only, AC-9-clean:
 *   { arc_id, entries: [{ snippet_id, take_session_id, take_index,
 *     slide_index, entered_at, text, audio_url, start_offset_ms,
 *     duration_ms }] }.
 *
 * Entries arrive in PRESENTATION order (slide ascending, no-slide last) —
 * the backend owns that ordering; nothing here re-sorts.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
): Promise<NextResponse> {
  const id = encodeURIComponent(params.arcId);
  const res = await callBackend(`/v2/explore/arc/${id}/voice-album`, {
    method: "GET",
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
