import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The plan as it stands (docs/flows/the-plan.md). `tz` is the browser's
 *  time zone: a practice day and its hello are the speaker's own days. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const tz = req.nextUrl.searchParams.get("tz");
  const query = tz ? `?${new URLSearchParams({ tz }).toString()}` : "";
  const response = await callBackend(`/v2/plan${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Change the deadline or the practice days. */
export const PUT = proxyRoute("PUT", "/v2/plan", { body: "json", noStore: true });
