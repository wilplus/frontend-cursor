import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// V4 B1.8: one answer (a moment, or none needs it), once.
export async function POST(
  req: NextRequest,
  { params }: { params: { sheetId: string } },
): Promise<NextResponse> {
  return relayJson(req, `/v2/coach/v4-moment-picks/${encodeURIComponent(params.sheetId)}/answer`, "POST");
}
