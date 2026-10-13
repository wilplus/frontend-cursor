import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET  /api/v2/admin/booking/user-price?user_id=  one person's lesson price
 * PUT  {user_id, price_cents}                      set it (null = list price)
 * Carries no secret; the backend's @require_admin is the gate. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get("user_id") || "";
  const res = await callBackend(`/v2/admin/booking/user-price?user_id=${encodeURIComponent(id)}`);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "INVALID_INPUT", error: "Body must be JSON" }, { status: 400 });
  }
  const res = await callBackend("/v2/admin/booking/user-price", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: body.user_id, price_cents: body.price_cents ?? null }),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
