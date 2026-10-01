import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 3 (F5): the speaker's own landed attempts, the coach readings
 *  and, under Phase 4, others' voices; plays only. */
export async function GET(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/user/takes/${encodeURIComponent(params.takeSessionId)}/bold-voices`, "GET");
}
