import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 4 (F4): the coach's own read of a licensed clip. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { clipId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/coach/corpus-clips/${encodeURIComponent(params.clipId)}/label`, "PUT");
}
