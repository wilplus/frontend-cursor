import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/coach/arcs/[arcId]/ab-pairs                                    */
/*    → BE GET /v2/coach/arcs/<arc_id>/ab-pairs                               */
/*                                                                            */
/*  The blinded comparison queue: the same slide, two takes, no labels.        */
/*                                                                            */
/*  The BE decides what a side may contain — words, audio, timing, and         */
/*  nothing that says WHICH take it is. This proxy adds no fields and reads    */
/*  none: a BFF that helpfully joined a take number back on would defeat the   */
/*  instrument, because a rater who can tell which take is later is rating a   */
/*  story about improvement rather than a delivery.                            */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  const all = req.nextUrl.searchParams.get("all") === "1" ? "?all=1" : "";
  return callBackend(`/v2/coach/arcs/${id}/ab-pairs${all}`, { method: "GET" });
}
