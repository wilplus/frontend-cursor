import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/coach/sessions/[sessionId]/confidence-queue                    */
/*    → BE GET /v2/coach/sessions/<session_id>/confidence-queue                */
/*                                                                            */
/*  The labelling queue: pieces sampled ACROSS the confidence spectrum so the  */
/*  corpus gets the negative examples a binary recogniser needs.               */
/*                                                                            */
/*  The payload deliberately carries no machine confidence read and no band    */
/*  (N1), and its order is band-shuffled so position is not a tell (N2). This  */
/*  proxy relays it verbatim — it must never sort, enrich or annotate, since   */
/*  either would rebuild exactly the hint the payload was shaped to remove.    */
/*                                                                            */
/*  COACH-ONLY; authorization is upstream (require_admin_or_coach).            */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }
    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }
    const sid = encodeURIComponent(params.sessionId);
    let upstream: Response;
    try {
      upstream = await fetch(
        `${backend}/v2/coach/sessions/${sid}/confidence-queue`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
    } catch (err) {
      console.error("coach_confidence_queue.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Labelling queue unavailable." },
        { status: 502 }
      );
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_confidence_queue.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-confidence-queue-v1",
      },
      { status: 500 }
    );
  }
}
