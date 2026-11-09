import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The list of AI models (backend N528, N566; routes/v2/learning_models.py):
 *  {intro, filters, drafts, models, empty?}. Forwards only `q` and `filter`.
 *  404 below ring 6 (feature `ai_models`): every way in stays hidden. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const source = req.nextUrl.searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["q", "filter"]) {
    const value = source.get(key);
    if (value) forwarded.set(key, value);
  }
  const query = forwarded.toString();
  const response = await callBackend(`/v2/models${query ? `?${query}` : ""}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
