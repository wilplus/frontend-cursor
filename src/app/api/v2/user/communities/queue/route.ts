import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Other speakers' moments to judge: the listener's communities first, then
 *  the general one, then training clips. Audio only. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/user/communities/queue", "GET");
}
