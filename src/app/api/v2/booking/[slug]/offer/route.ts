import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/booking/<slug>/offer[?as=<user_id>] — the signed-in person's
 * price and tokens. `as` lets an admin see someone else's page; the backend
 * checks the admin. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  const as = req.nextUrl.searchParams.get("as");
  const q = as ? `?as=${encodeURIComponent(as)}` : "";
  const res = await callBackend(`/v2/booking/${encodeURIComponent(params.slug)}/offer${q}`);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
