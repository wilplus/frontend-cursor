import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

const QUERY_KEYS = ["take_session_id", "snippet_ids"];

/** Why each green moment landed, while the walk waits for one still being
 *  written (founder 2026-10-18). Read only; the backend decides ownership. */
export async function GET(request: NextRequest, context: { params: { arcId: string } }): Promise<NextResponse> {
  const query = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const response = await callBackend(
    `/v2/explore/arc/${encodeURIComponent(context.params.arcId)}/praise-reasons?${query.toString()}`,
    { method: "GET" },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
