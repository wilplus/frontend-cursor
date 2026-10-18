import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  callBackend,
  failure,
  getAccessToken,
  relayStrict,
  type Failures,
} from "@/app/api/_lib/backend";

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

const UNAUTHENTICATED = { status: 401, body: { error: "Not authenticated" } };
const FAILURES: Failures = {
  unauthenticated: UNAUTHENTICATED,
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Token service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function relayTokensGet(
  _req: NextRequest,
  path: string,
  search?: URLSearchParams
): Promise<NextResponse> {
  if (path === "prices") return servePrices();
  const qs = search?.toString();
  return callBackend(`/v2/tokens/${path}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}

/* -------------------------------------------------------------------------- */
/*  THE PRICE LIST IS THE SAME FOR EVERYONE (founder 2026-10-18), so one       */
/*  server instance asks the backend for it once per PRICES_COPY_TTL_MS and   */
/*  answers from its copy in between. Under Fluid compute an instance serves  */
/*  many people for a long time, so most reads skip the hop to Railway, which */
/*  was the whole of this route's work (the backend's own stopwatch read 0).  */
/*                                                                            */
/*  The relay rule above holds: the copy IS the backend's 200 body, served    */
/*  unchanged — {"enabled": false} included — so the FE's branch on it sees   */
/*  exactly what the backend said, at most five minutes ago. Nothing but a    */
/*  200 is kept: an error is relayed as it comes and asked again next time.  */
/*                                                                            */
/*  Signed-out stays refused before the copy is touched (the same 401 as a    */
/*  live call). What a served copy does NOT do is have the backend verify     */
/*  the token again: a bearer must be present, not proven. The list carries   */
/*  no account data and is what every signed-in person sees, so a copy is    */
/*  nothing a forged bearer could not read a minute later with a real one.   */
/* -------------------------------------------------------------------------- */

const PRICES_COPY_TTL_MS = 5 * 60_000;
let pricesCopy: { at: number; body: unknown } | null = null;

async function servePrices(): Promise<NextResponse> {
  const started = performance.now();
  if (pricesCopy && Date.now() - pricesCopy.at < PRICES_COPY_TTL_MS) {
    if (!(await getAccessToken())) return failure(UNAUTHENTICATED);
    const response = NextResponse.json(pricesCopy.body, { status: 200 });
    response.headers.set(
      "Server-Timing",
      `bff;dur=${(performance.now() - started).toFixed(0)}, copy;desc="price list from this server instance"`
    );
    return response;
  }
  const response = await callBackend("/v2/tokens/prices", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
  if (response.status === 200) {
    try {
      pricesCopy = { at: Date.now(), body: await response.clone().json() };
    } catch {
      // Not JSON (an empty 200 relayed bare): nothing worth keeping.
    }
  }
  return response;
}
