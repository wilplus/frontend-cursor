import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Join a community with a pass code. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/user/communities/join", "POST");
}
