import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/** One idiom for the after-practice BFF routes (Phases 3 and 4, founder
 *  2026-10-01): relay the body as JSON to the backend path. Every route
 *  below is dark on the backend until its switch; the relay adds nothing. */
export async function relayJson(
  req: NextRequest,
  path: string,
  method: "GET" | "POST" | "PUT",
): Promise<NextResponse> {
  if (method === "GET") return callBackend(path, { method });
  return callBackend(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}

/** Multipart bodies (a coach's reading, a licensed clip) pass through whole. */
export async function relayForm(
  req: NextRequest,
  path: string,
): Promise<NextResponse> {
  const form = await req.formData();
  return callBackend(path, { method: "POST", body: form });
}
