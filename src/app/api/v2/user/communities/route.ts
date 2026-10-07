import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** List the caller's communities. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/user/communities", "GET");
}

/** Open a community. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/user/communities", "POST");
}
