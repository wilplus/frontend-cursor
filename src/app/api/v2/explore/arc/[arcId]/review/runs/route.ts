import { type NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: { arcId: string } }) {
  const paramsToRelay = new URLSearchParams();
  for (const key of ["take", "exchange", "chat"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value !== null) paramsToRelay.set(key, value);
  }
  const query = paramsToRelay.size ? "?" + paramsToRelay.toString() : "";
  const response = await callBackend(`/v2/explore/arc/${encodeURIComponent(params.arcId)}/review/runs${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
