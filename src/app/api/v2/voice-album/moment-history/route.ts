import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/voice-album/moment-history?arc=<projectId>&moment=<momentKey>
 *
 * BFF proxy — where one Album moment came from: the Take and Slide it was
 * recorded in, the owner's own answer, that a coach heard the same thing, the
 * exercise assigned to that exact clip with its video and the owner's
 * attempts, and the owner's notes. Chronological.
 *
 * Data only, AC-9-clean: no score, ratio or verdict in any lane, and the
 * coach is never named. Ordering is the backend's; nothing here re-sorts.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const arc = req.nextUrl.searchParams.get("arc") ?? "";
  const moment = req.nextUrl.searchParams.get("moment") ?? "";
  if (!arc || !moment) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "arc and moment are required" },
      { status: 400 }
    );
  }
  const query =
    `arc=${encodeURIComponent(arc)}&moment=${encodeURIComponent(moment)}`;
  const res = await callBackend(`/v2/voice-album/moment-history?${query}`, {
    method: "GET",
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
