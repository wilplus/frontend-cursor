import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The one queue across every model the caller teaches (backend N563 item 1):
 *  {header, models, hint, actions, examples} or {empty, models, examples: []}.
 *  `only` opens one model alone. 404 below ring 6. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const only = req.nextUrl.searchParams.get("only");
  const query = only ? `?${new URLSearchParams({ only }).toString()}` : "";
  const response = await callBackend(`/v2/models/queue${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
