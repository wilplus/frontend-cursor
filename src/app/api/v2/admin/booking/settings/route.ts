import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

const FIELDS = [
  "slug", "title", "host_name", "duration_min", "price_cents", "currency",
  "buffer_before_min", "buffer_after_min", "notice_hours", "horizon_days",
  "timezone", "weekly_hours", "calendar_ics_url", "meet_url", "enabled", "new_user_discount_pct",
];

/* PUT /api/v2/admin/booking/settings — save. The body is rebuilt from the
 * known fields; the backend validates each one and @require_admin gates it. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "INVALID_INPUT", error: "Body must be JSON" }, { status: 400 });
  }
  const forwarded: Record<string, unknown> = {};
  for (const key of FIELDS) if (body[key] !== undefined) forwarded[key] = body[key];
  const res = await callBackend("/v2/admin/booking/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forwarded),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
