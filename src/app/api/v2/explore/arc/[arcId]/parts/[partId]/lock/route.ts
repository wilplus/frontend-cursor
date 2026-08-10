import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/parts/[partId]/lock
 *
 * BFF proxy — lock or unlock ONE part of the ideal text (SPEC §4 / R3 / R5,
 * SPEC-lockin-loop §2). Body {locked, text_echo, parts?} relays verbatim —
 * `parts` is the seed-on-lock list for documents with no stored identity yet.
 * Status passthrough matters here: the FE discriminates the two 409s
 * (UNDECIDED vs STALE_DOCUMENT) by body code, one is a message and the other
 * a silent refetch.
 *
 * THIS ROUTE WAS MISSING. setPartLock shipped with the arranger's lock
 * toggle, and every call 404ed against Next before reaching the backend —
 * mapped to {kind: "error"}, rendered as a silent "failed". The lock feature
 * existed at both ends and was dead in the middle; this file is the middle.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string; partId: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const part = encodeURIComponent(params.partId);
  return callBackend(`/v2/explore/arc/${arc}/parts/${part}/lock`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
