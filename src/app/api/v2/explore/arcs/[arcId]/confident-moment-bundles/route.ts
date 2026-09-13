import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { arcId: string } }) {
  const takeId = request.nextUrl.searchParams.get("take_id") ?? "";
  return callBackend(
    `/v2/explore/arcs/${encodeURIComponent(params.arcId)}/confident-moment-bundles?take_id=${encodeURIComponent(takeId)}`,
    { method: "GET" },
  );
}
