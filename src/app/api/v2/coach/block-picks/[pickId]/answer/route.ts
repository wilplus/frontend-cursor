import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 8: one pick (a clip, or can't tell), once.
export async function POST(
  req: NextRequest,
  { params }: { params: { pickId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/coach/block-picks/${encodeURIComponent(params.pickId)}/answer`, "POST");
}
