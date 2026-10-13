import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/admin/booking — booking settings and upcoming bookings.
 * Carries no secret; the backend's @require_admin is the gate. */
export async function GET(): Promise<NextResponse> {
  const res = await callBackend("/v2/admin/booking");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
