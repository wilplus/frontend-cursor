import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/parts/[partId]/helper-words
 *
 * BFF proxy — helper words taken from any earlier Take (founder lock
 * 2026-09-30, B4, D5). Body {phrase, take_index} relays verbatim; the
 * backend checks the words are exact words of that Take's version and
 * stores them on the Slide. The lock that follows goes through /lock.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string; partId: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const part = encodeURIComponent(params.partId);
  return callBackend(`/v2/explore/arc/${arc}/parts/${part}/helper-words`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
