import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** A draft where it stopped ("Continue", backend N566 item 2), or one step
 *  (`?step=`, a checklist item). Forwards only `step`. 404 to anyone but the
 *  owner, and below ring 6. */
export async function GET(req: NextRequest, { params }: { params: { modelId: string } }): Promise<NextResponse> {
  const step = req.nextUrl.searchParams.get("step");
  const query = step ? `?${new URLSearchParams({ step }).toString()}` : "";
  const response = await callBackend(`/v2/models/${encodeURIComponent(params.modelId)}/setup${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
