import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/tokens/portal — a Stripe billing-portal session.              */
/*                                                                            */
/*  Switch, cancel, fix a declined card, past invoices. Status and body relay  */
/*  verbatim through callBackend/proxyResponse, which matters here: a route    */
/*  that "helpfully" rewrote a status would erase the difference between       */
/*  "there is nothing to manage" (404 NO_SUBSCRIPTION — not an error, and the  */
/*  wallet renders nothing) and "billing is broken".                          */
/*                                                                            */
/*  THE BODY IS REBUILT, NOT PASSED THROUGH — same rule as the admin grant     */
/*  route: only `return_url` reaches the backend, never a field a caller       */
/*  appended. The FE owns that one value because it owns the route it points   */
/*  at; the backend's default is {FRONTEND_URL}/account, which this app has    */
/*  no route for.                                                             */
/*                                                                            */
/*  NOT GATED ON TOKEN_PRICING_ENABLED, deliberately, and neither is the       */
/*  backend route: that flag governs whether actions are CHARGED. It must      */
/*  never be the reason someone cannot cancel a plan they are paying for.     */
/* -------------------------------------------------------------------------- */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // An absent body is fine — the backend has its own default return URL.
    body = {};
  }
  const forwarded: Record<string, unknown> = {};
  if (typeof body.return_url === "string") forwarded.return_url = body.return_url;

  const res = await callBackend("/v2/tokens/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forwarded),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
