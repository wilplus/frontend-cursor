import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The history behind a Paragraph's bookmark (contract 16). Owner only. */
export async function GET(
  request: NextRequest,
  { params }: { params: { arcId: string; partId: string } },
) {
  const arcId = encodeURIComponent(params.arcId);
  const partId = encodeURIComponent(params.partId);
  void request;
  return callBackend(`/v2/explore/arc/${arcId}/parts/${partId}/history`, {
    method: "GET",
  });
}
