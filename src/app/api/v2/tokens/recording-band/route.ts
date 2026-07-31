import { NextRequest, NextResponse } from "next/server";
import { relayTokensGet } from "../proxy";

export const runtime = "nodejs";

/**
 * GET /api/v2/tokens/recording-band
 *
 * What the next take will cost and the length band it buys, so the price can
 * be shown ON the record trigger BEFORE it fires.
 *
 * `max_seconds` is ADVISORY and `can_record:false` is NOT a client-side block:
 * takes charge after transcription and fail open, so an over-length or
 * over-budget recording still produces a transcript. The FE surfaces the
 * offer; it never withholds the record button on the strength of this read.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayTokensGet(req, "recording-band");
}
