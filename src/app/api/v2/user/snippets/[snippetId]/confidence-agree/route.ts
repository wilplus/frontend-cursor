import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/user/snippets/[snippetId]/confidence-agree                     */
/*    → BE PUT /v2/user/snippets/<snippet_id>/confidence-agree                 */
/*                                                                            */
/*  The displayed Confident Voice card's owner response. It is routed          */
/*  verbatim to the backend and stored only as Voice Album routing state.      */
/*  It never trains, calibrates, votes in quorum, evaluates, or feeds SFT/DPO. */
/*  Auth is required; the backend ownership-gates the snippet.                 */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
): Promise<NextResponse> {
  const id = encodeURIComponent(params.snippetId);
  const body = await req.text();
  return callBackend(`/v2/user/snippets/${id}/confidence-agree`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });
}
