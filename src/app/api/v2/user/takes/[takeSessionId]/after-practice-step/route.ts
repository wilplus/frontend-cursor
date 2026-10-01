import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 3: the Take showed one after-practice step (bridge, Lend your
 *  ear, Bold voices); once per Take per step. */
export async function POST(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/user/takes/${encodeURIComponent(params.takeSessionId)}/after-practice-step`, "POST");
}
