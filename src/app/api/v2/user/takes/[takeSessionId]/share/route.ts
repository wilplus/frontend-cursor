import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Relay a take share choice. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { takeSessionId: string } },
): Promise<NextResponse> {
  return relayJson(
    req,
    `/v2/user/takes/${encodeURIComponent(params.takeSessionId)}/share`,
    "PUT",
  );
}
