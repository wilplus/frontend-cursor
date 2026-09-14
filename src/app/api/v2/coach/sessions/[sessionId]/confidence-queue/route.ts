import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

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

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Labelling queue unavailable." } },
};
const LANGUAGE_FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
};
const RELAY = relayLenient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sid = encodeURIComponent(params.sessionId);
    return await callBackend(`/v2/coach/sessions/${sid}/confidence-queue`, {
      method: "GET",
      failures: FAILURES,
      relay: RELAY,
    });
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

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sid = encodeURIComponent(params.sessionId);
    const body = await req.text();
    return await callBackend(`/v2/coach/sessions/${sid}/language`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      failures: LANGUAGE_FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    console.error("coach_session_language.bff_thrown surface=fe-bff", err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: "Language confirmation unavailable." },
      { status: 500 }
    );
  }
}
