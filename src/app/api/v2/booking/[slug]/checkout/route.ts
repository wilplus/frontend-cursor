import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* POST /api/v2/booking/<slug>/checkout — hold the time and open Stripe.
 * The body is rebuilt from the five fields the page sends. The caller's IP is
 * forwarded so the backend's per-IP limit counts guests, not this server. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "INVALID_INPUT", error: "Body must be JSON" }, { status: 400 });
  }
  const forwarded: Record<string, unknown> = {};
  for (const key of ["start", "name", "email", "timezone", "note"]) {
    if (typeof body[key] === "string") forwarded[key] = body[key];
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ip) headers["X-Forwarded-For"] = ip;
  const res = await callBackend(`/v2/booking/${encodeURIComponent(params.slug)}/checkout`, {
    method: "POST",
    requireAuth: false,
    token: null,
    headers,
    body: JSON.stringify(forwarded),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
