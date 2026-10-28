import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { clientHeaders } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* POST /api/v2/signup/seen — the sign-up screen opened (backend N207 item 6).
 * No sign-in: the screen is for people without an account. The caller's IP
 * address is forwarded only for the backend's rate limit; the backend keeps a
 * number a day and nothing about the person. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const res = await callBackend("/v2/signup/seen", {
    method: "POST",
    requireAuth: false,
    token: null,
    headers: clientHeaders(req),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
