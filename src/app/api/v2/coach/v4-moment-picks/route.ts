import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// V4 B1.8 (founder S-B8 A): "Pick the moment for feedback", this rater's
// pending blocks, words and audio only. Dark (404) until V4_COACH_SHEETS_ENABLED.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/coach/v4-moment-picks", "GET");
}
