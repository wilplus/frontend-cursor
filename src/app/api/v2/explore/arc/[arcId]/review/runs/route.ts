import { type NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: { arcId: string } }) {
  const take = req.nextUrl.searchParams.get("take");
  const query = take === null ? "" : `?take=${encodeURIComponent(take)}`;
  const response = await callBackend(`/v2/explore/arc/${encodeURIComponent(params.arcId)}/review/runs${query}`, { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
