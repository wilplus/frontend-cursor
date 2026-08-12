import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/admin/tokens/grant — add non-expiring tokens to one account.  */
/*                                                                            */
/*  Carries no secret; the backend's @require_admin is the gate and the        */
/*  caller's JWT is all that is forwarded (see ../lookup/route.ts).            */
/*                                                                            */
/*  THE BODY IS REBUILT, NOT PASSED THROUGH. This route moves money, so what   */
/*  reaches the backend is exactly the four fields the panel sends and nothing */
/*  a caller appended — the same reasoning as the lookup's query allowlist,    */
/*  applied where it matters more. `ref_id` is the client's idempotency key    */
/*  and is forwarded verbatim: minting one here would be fresh per attempt,    */
/*  which would defeat the guard it exists to be.                              */
/* -------------------------------------------------------------------------- */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { code: "INVALID_INPUT", error: "Body must be JSON" },
      { status: 400 }
    );
  }
  const forwarded: Record<string, unknown> = {};
  for (const key of ["email", "user_id", "tokens", "ref_id"]) {
    if (body[key] !== undefined) forwarded[key] = body[key];
  }
  const res = await callBackend("/v2/admin/tokens/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forwarded),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
