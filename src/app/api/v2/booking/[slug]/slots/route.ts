import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/booking/<slug>/slots?from=&to=[&link=] — open start times (UTC
 * ISO). Only `from`, `to` and `link` are forwarded; `link` is a price link,
 * whose meeting length the backend checks and applies. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  const q = new URLSearchParams();
  for (const key of ["from", "to", "link"]) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) q.set(key, v);
  }
  const res = await callBackend(`/v2/booking/${encodeURIComponent(params.slug)}/slots?${q}`, {
    requireAuth: false,
    token: null,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
