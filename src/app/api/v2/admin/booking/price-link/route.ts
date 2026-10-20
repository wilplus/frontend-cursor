import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/admin/booking/price-link?price_cents=  a booking link that
 * charges that price and makes it the booker's own lesson price.
 * Carries no secret; the backend's @require_admin is the gate. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cents = req.nextUrl.searchParams.get("price_cents") || "";
  const res = await callBackend(`/v2/admin/booking/price-link?price_cents=${encodeURIComponent(cents)}`);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
