import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/coach/snippets/[snippetId]/slide                               */
/*    → BE PUT /v2/coach/snippets/<snippet_id>/slide                          */
/*                                                                            */
/*  The coach's word→slide ground truth: which slide was ON SCREEN while this  */
/*  snippet was spoken. Body { slide_index: int | null } — null withdraws a    */
/*  correction and hands the take back to the pipeline's own answer.           */
/*                                                                            */
/*  The body is relayed VERBATIM, and that matters more here than usual: the   */
/*  BE validates the index against the session's actual deck, and a proxy that */
/*  "helpfully" coerced "2" into 2 would turn a UI bug into a fabricated       */
/*  label. This corpus is the only ground truth the slide pipeline will ever   */
/*  be measured against — it cannot survive invented rows.                     */
/*                                                                            */
/*  Its siblings (confidence-label, star-verdict) still hand-roll their fetch  */
/*  and are grandfathered in the BFF ratchet; new routes go through            */
/*  callBackend, which owns auth, the 502s and verbatim status pass-through.   */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  const id = encodeURIComponent(params.snippetId);
  const body = await req.text();
  return callBackend(`/v2/coach/snippets/${id}/slide`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });
}
