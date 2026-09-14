import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/coach/sessions/<session_id>/snippets/<snippet_id>
 *
 * BFF proxy for per-snippet draft save (§B.3). Verbatim pass-through to
 * `POST /v2/coach/sessions/<sid>/snippets/<sid>` on the BE.
 *
 * Body accepts any subset of:
 *   { note?, tag?, surfaced? }
 *
 * USER LANE ONLY — surfaced authored feedback becomes an exact-evidence
 * FeedbackItem at publish time.
 *
 * Retired private-direction fields are not part of this user-lane contract.
 * Blind labeling writes the state-generic ternary through
 * PUT /api/v2/coach/snippets/<id>/confidence-label — a SEPARATE route, which
 * is the split-sink wall doing its job rather than two lanes sharing a body.
 *
 * Returns the echoed `coach_state` on success so the FE can confirm
 * without an extra fetch (optimistic UI works against the echo).
 *
 * Authorization is server-enforced via `require_admin_or_coach` upstream;
 * the FE `is_coach` flag is render-only.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coach snippet save service unavailable." } },
};
const RELAY = relayLenient();

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } }
) {
  try {
    const sid = encodeURIComponent(params.sessionId);
    const nid = encodeURIComponent(params.snippetId);
    const body = await req.text();
    return await callBackend(`/v2/coach/sessions/${sid}/snippets/${nid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body || "{}",
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_snippet_save.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-snippet-save-v1",
      },
      { status: 500 }
    );
  }
}
