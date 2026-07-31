import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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

export async function relayTokensGet(
  req: NextRequest,
  path: string,
  search?: URLSearchParams
): Promise<NextResponse> {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  const qs = search?.toString();
  const url = `${backend}/v2/tokens/${path}${qs ? `?${qs}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error(`GET /api/v2/tokens/${path} — fetch failed:`, err);
    return NextResponse.json({ error: "Token service unavailable." }, { status: 502 });
  }

  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
