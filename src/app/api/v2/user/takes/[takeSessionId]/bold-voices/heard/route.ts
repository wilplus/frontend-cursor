import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 3: the speaker heard a Bold voices clip; a receipt, nothing judged. */
export async function POST(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/user/takes/${encodeURIComponent(params.takeSessionId)}/bold-voices/heard`, "POST");
}
