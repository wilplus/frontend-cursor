import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/coach/arcs/[arcId]/ab-verdict                                  */
/*    → BE PUT /v2/coach/arcs/<arc_id>/ab-verdict                             */
/*                                                                            */
/*  One blinded judgment: { pair_id, verdict: "left" | "right" | "tie" }.      */
/*                                                                            */
/*  The body is relayed VERBATIM. The BE resolves the blinded side back to a   */
/*  real session — deliberately, so the answer to "which take did I just       */
/*  pick" exists nowhere on this side of the wire and a rater cannot drift     */
/*  toward the later take over a session of ratings.                           */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  const body = await req.text();
  return callBackend(`/v2/coach/arcs/${id}/ab-verdict`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });
}
