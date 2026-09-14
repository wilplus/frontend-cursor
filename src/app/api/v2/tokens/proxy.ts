import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  tokens BFF — one relay for all four wallet reads                          */
/*                                                                            */
/*  /v2/tokens/{balance,prices,recording-band,history} are the same shape of   */
/*  request: authed, read-only, GET, relayed verbatim. They are folded into    */
/*  one helper (as admin/learning does) rather than four copies of the same    */
/*  fifty lines, because the thing that must NOT drift between them is the     */
/*  relay: the flag-off body `{"enabled": false}` arrives as a 200 on purpose  */
/*  and the FE branches on it, so any route that "helpfully" rewrote a status  */
/*  or body would erase the difference between "pricing is off" and "the       */
/*  backend is broken".                                                        */
/*                                                                            */
/*  None of these endpoints charge — charging happens at the action being      */
/*  paid for — so there is no side effect to guard against on a retry or a     */
/*  double mount.                                                              */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Token service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function relayTokensGet(
  _req: NextRequest,
  path: string,
  search?: URLSearchParams
): Promise<NextResponse> {
  const qs = search?.toString();
  return callBackend(`/v2/tokens/${path}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
