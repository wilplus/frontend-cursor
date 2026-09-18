import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v2/voice-album/note
 *
 * BFF proxy — the owner's own note at the end of a Voice Album moment.
 * Body { arc_id, moment_key, body } passed through verbatim.
 *
 * The note is personal recall, not a rating: the backend keeps it in its own
 * owner-scoped table that no training, quorum, calibration, evaluation or
 * Album-admission path reads, and writing one never moves a moment into or
 * out of the Album.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const res = await callBackend("/v2/voice-album/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
