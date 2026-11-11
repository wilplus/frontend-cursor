import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** Downloading a model's data (backend N528 item 12, MOD-51): the screen,
 *  or with ?rows=1 (forwarded alone) the teachers' own ratings and answers.
 *  404 below the ring. */
export async function GET(req: NextRequest, context: { params: { modelId: string } }): Promise<NextResponse> {
  // ?rows=1 alone, or ?format=jsonl|csv|version (Developer mode's "Your training data", N648 item 6).
  const format = req.nextUrl.searchParams.get("format");
  const query = req.nextUrl.searchParams.get("rows") === "1" ? "?rows=1" : format && /^(jsonl|csv|version)$/.test(format) ? `?format=${format}` : "";
  const response = await callBackend(`/v2/models/${encodeURIComponent(context.params.modelId)}/download${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
