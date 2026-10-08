import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** Many Paragraphs' histories in one read: the paragraph sheet's read-ahead
 *  (contract 16, batched). Owner only. Only `part_ids` is forwarded. */
export async function GET(
  request: NextRequest,
  { params }: { params: { arcId: string } },
) {
  const arcId = encodeURIComponent(params.arcId);
  const forwarded = new URLSearchParams();
  forwarded.set("part_ids", request.nextUrl.searchParams.get("part_ids") ?? "");
  return callBackend(`/v2/explore/arc/${arcId}/part-histories?${forwarded.toString()}`, {
    method: "GET",
    guestOwnerFrom: request,
  });
}
