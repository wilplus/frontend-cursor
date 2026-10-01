import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 3: publish or withdraw one of the coach's readings. */
export async function POST(
  req: NextRequest,
  { params }: { params: { readingId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/coach/readings/${encodeURIComponent(params.readingId)}/publish`, "POST");
}
