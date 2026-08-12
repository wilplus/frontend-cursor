import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/admin/tokens/lookup?email=… — one account's balance.           */
/*                                                                            */
/*  CARRIES NO SECRET, same as the pipeline panel's proxy and for the same     */
/*  reason. The backend grew an @require_admin route; this forwards only the   */
/*  caller's JWT and the BACKEND IS THE GATE. A non-admin gets the backend's   */
/*  403 passed straight through. The older /v2/internal/student-credits/*      */
/*  pair took a shared password in the body — a second credential that moves   */
/*  money and exists only for one page; nothing here is involved in that path. */
/*                                                                            */
/*  Query keys are ALLOWLISTED. Forwarding the incoming search string whole    */
/*  would let a caller append arbitrary params to an admin endpoint.           */
/* -------------------------------------------------------------------------- */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const src = req.nextUrl.searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["email", "user_id"]) {
    const value = src.get(key);
    if (value) forwarded.set(key, value);
  }
  const qs = forwarded.toString();
  const res = await callBackend(
    `/v2/admin/tokens/lookup${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
  // A cached balance is a wrong balance — this panel exists to change it.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
