import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { clientHeaders } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* POST /api/v2/first-visit/step — a visitor without an account reached a
 * step on the way to their first feedback (backend N271). No sign-in. The
 * caller's IP address is forwarded only for the backend's rate limit; the
 * backend keeps a number a day and nothing about the person. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const res = await callBackend("/v2/first-visit/step", {
    method: "POST",
    requireAuth: false,
    token: null,
    headers: { ...clientHeaders(req), "Content-Type": "application/json" },
    body,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
