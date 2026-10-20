import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The voice notebook's state for the signed-in person (Will learning plan,
 *  step 1). `tz` is the browser's time zone: the backend keeps it so the
 *  Sunday note (step 2) comes at 6 pm the person's own time. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const tz = req.nextUrl.searchParams.get("tz");
  const query = tz ? `?${new URLSearchParams({ tz }).toString()}` : "";
  const response = await callBackend(`/v2/notebook/state${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
