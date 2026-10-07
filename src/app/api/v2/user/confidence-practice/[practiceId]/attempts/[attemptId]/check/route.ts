import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Relay a confidence-practice attempt check. The walk sees only next and key. */
export async function POST(
  req: NextRequest,
  { params }: { params: { practiceId: string; attemptId: string } },
): Promise<NextResponse> {
  return relayJson(
    req,
    `/v2/user/confidence-practice/${encodeURIComponent(params.practiceId)}/attempts/${encodeURIComponent(params.attemptId)}/check`,
    "POST",
  );
}
