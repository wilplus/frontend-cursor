import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 4 (F3): the Take's set of up to three clips, audio only. */
export async function GET(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/user/takes/${encodeURIComponent(params.takeSessionId)}/lend-your-ear`, "GET");
}
