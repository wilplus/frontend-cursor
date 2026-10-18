import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/booking/<slug>/offer[?as=<user_id>&link=] — the signed-in
 * person's price and tokens. `as` lets an admin see someone else's page; the
 * backend checks the admin. `link` is a price link, checked by the backend. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  const q = new URLSearchParams();
  for (const key of ["as", "link"]) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) q.set(key, v);
  }
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await callBackend(`/v2/booking/${encodeURIComponent(params.slug)}/offer${qs}`);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
