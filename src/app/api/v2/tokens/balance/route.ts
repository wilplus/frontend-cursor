import { NextRequest, NextResponse } from "next/server";
import { relayTokensGet } from "../proxy";

export const runtime = "nodejs";

/**
 * GET /api/v2/tokens/balance
 *
 * The wallet read: balance, tier, the period it renews on, and the SEPARATE
 * coach-review allowance. Read-only and free to poll.
 *
 * Two payload states the FE must not conflate:
 *   {"enabled": false}   → pricing is off; render no wallet UI at all.
 *   {"available": false} → the account could not be read; UNKNOWN, not zero.
 * Relayed verbatim, status included.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayTokensGet(req, "balance");
}
