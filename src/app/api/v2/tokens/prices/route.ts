import { NextRequest, NextResponse } from "next/server";
import { relayTokensGet } from "../proxy";

export const runtime = "nodejs";

/**
 * GET /api/v2/tokens/prices
 *
 * THE source of truth for every price the FE shows: per-action prices, the
 * duration bands a take is charged in, and the monthly tiers.
 *
 * Nothing here may be copied into the FE as a literal. The numbers get re-set
 * once the cost measurements land, and `price_version` exists so a stale
 * cached list is detectable rather than silently wrong.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayTokensGet(req, "prices");
}
