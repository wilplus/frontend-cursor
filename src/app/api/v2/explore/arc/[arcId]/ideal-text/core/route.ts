import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { arcId: string } },
) {
  const arcId = encodeURIComponent(params.arcId);
  void request;
  return callBackend(`/v2/explore/arc/${arcId}/ideal-text/core`, {
    method: "GET",
  });
}

