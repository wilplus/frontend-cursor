import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Set your price", the model's founder's only (backend N566 item 10, N577,
 *  N583 item 3, MOD-46): GET reads it with the split for `uses` answers a
 *  month, and with `units` previews that price and its split without saving
 *  it (both forwarded alone, digits only); POST {units} sets it, never below
 *  what an answer costs to run. 404 for anyone else and below the ring. */
export async function GET(req: NextRequest, context: { params: { modelId: string } }): Promise<NextResponse> {
  const params = new URLSearchParams();
  for (const key of ["uses", "units"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value && /^\d{1,7}$/.test(value)) params.set(key, value);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await callBackend(`/v2/models/${encodeURIComponent(context.params.modelId)}/price${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const POST = proxyRoute("POST", "/v2/models/:modelId/price", { body: "json", noStore: true });
