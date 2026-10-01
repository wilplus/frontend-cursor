import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayForm, relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Phase 4 (F4): the licensed corpus; GET lists, POST files one (multipart). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/coach/corpus-clips", "GET");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return relayForm(req, "/v2/coach/corpus-clips");
}
