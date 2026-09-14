import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/coach/snippets/[snippetId]/confidence-label                    */
/*    → BE PUT /v2/coach/snippets/<snippet_id>/confidence-label               */
/*                                                                            */
/*  One coach's call on one piece: confident yes/no, optionally 1–5, plus a    */
/*  private note. Re-labelling replaces this coach's call; other raters' are   */
/*  untouched.                                                                 */
/*                                                                            */
/*  The body is relayed VERBATIM — the BE owns validation, and that matters    */
/*  here: `confident` must be a real JSON boolean and `"true"` is a 400, not a */
/*  coercion. A BFF that "helpfully" coerced it would turn a bug into          */
/*  fabricated training data, which is the one thing this corpus cannot        */
/*  survive. The 400's reason and the migration-naming 500 pass through for    */
/*  the UI to show verbatim.                                                   */
/*                                                                            */
/*  Sibling of the star-verdict route under the same snippet-rooted segment.   */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Label service unavailable." } },
};
const RELAY = relayLenient();

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  try {
    const id = encodeURIComponent(params.snippetId);
    const body = await req.text();
    return await callBackend(`/v2/coach/snippets/${id}/confidence-label`, {
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
      `coach_confidence_label.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-confidence-label-v1",
      },
      { status: 500 }
    );
  }
}
