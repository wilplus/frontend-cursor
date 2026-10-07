import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Relay the community answer queue. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/user/communities/queue", "GET");
}
