import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Phase 4 (F3): one answer on one clip of the set. */
export async function POST(
  req: NextRequest,
  { params }: { params: { setId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/user/lend-your-ear/${encodeURIComponent(params.setId)}/answers`, "POST");
}
