import { NextRequest, NextResponse } from "next/server";
import { relayTokensGet } from "../proxy";

export const runtime = "nodejs";

/**
 * GET /api/v2/tokens/history?limit=&before_id=
 *
 * The wallet ledger — what was spent, on what, and when. Keyset-paginated:
 * the response's `next_before_id` is the cursor for the next page.
 *
 * Only the two documented params are forwarded. Relaying the caller's whole
 * query string would let anything the client appends reach the backend, and a
 * ledger is exactly the endpoint where that should not be casual.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const incoming = req.nextUrl.searchParams;
  const search = new URLSearchParams();
  const limit = incoming.get("limit");
  if (limit) search.set("limit", limit);
  const beforeId = incoming.get("before_id");
  if (beforeId) search.set("before_id", beforeId);
  return relayTokensGet(req, "history", search);
}
