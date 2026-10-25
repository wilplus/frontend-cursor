import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/admin/booking/price-link?price_cents=[&duration_min=]  a booking
 * link that charges that price and makes it the booker's own lesson price,
 * for a meeting of `duration_min` minutes when given.
 * Carries no secret; the backend's @require_admin is the gate. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = new URLSearchParams();
  for (const key of ["price_cents", "duration_min"]) {
    const v = req.nextUrl.searchParams.get(key);
    if (v !== null) q.set(key, v);
  }
  const res = await callBackend(`/v2/admin/booking/price-link?${q}`);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
