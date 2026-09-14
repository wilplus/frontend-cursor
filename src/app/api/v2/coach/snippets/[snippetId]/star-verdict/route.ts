import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/coach/snippets/[snippetId]/star-verdict                        */
/*    → BE PUT /v2/coach/snippets/<snippet_id>/star-verdict                    */
/*                                                                            */
/*  Saves ONE coach verdict on a machine-fired star (upsert — re-judging       */
/*  replaces). Snippet-ROOTED on purpose: the BE contract has no session       */
/*  segment here, unlike the existing coach snippet routes nested under        */
/*  sessions/[sessionId] — do not "tidy" this into that tree.                  */
/*                                                                            */
/*  The body is relayed verbatim (the BE owns validation — a wrong_kind        */
/*  without corrected_device 400s upstream with a reason the UI shows).       */
/*  Coach authorization is upstream (require_admin_or_coach); 4xx passes      */
/*  through untouched, including the migration-gate 500 that names            */
/*  add_star_verdicts.sql.                                                     */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Star verdict service unavailable." } },
};
const RELAY = relayLenient();

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  try {
    const id = encodeURIComponent(params.snippetId);
    const body = await req.text();
    return await callBackend(`/v2/coach/snippets/${id}/star-verdict`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body || "{}",
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_star_verdict.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-star-verdict-v1",
      },
      { status: 500 }
    );
  }
}
