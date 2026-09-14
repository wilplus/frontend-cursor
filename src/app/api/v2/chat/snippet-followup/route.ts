import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/chat/snippet-followup
 *
 * After the user labels a snippet (YES/NO), the chat surface asks
 * the backend to produce a short follow-up sentence that:
 *   - acknowledges the user's classification,
 *   - reflects whether they agreed or disagreed with the AI's read,
 *   - opens a thread the user can answer (so the next snippet's
 *     reveal feels like a continuation, not a sudden context shift).
 *
 * Proxies to backend POST /v2/chat/snippet-followup.
 *
 * Body: { snippet_id: string (uuid), user_label: boolean }
 *   `user_label: true`  → user AGREED with the AI's classification.
 *   `user_label: false` → user DISAGREED.
 *   This semantic is pinned in docs/PANEL-STATE-MATRIX.md (default
 *   = AGREEMENT). The backend smoke at scripts/smoke-snippet-followup.sh
 *   can flip the matrix's "Pinned semantics" section if the reply
 *   text proves the contract is TYPE semantic instead.
 *
 * Success 200: { followup_text: string (non-empty), debug?: object }
 * 401 UNAUTHENTICATED
 * 5xx — backend unavailable. Caller should fall back to a static
 *       "Noted — let's keep going." bubble and move to the next
 *       snippet (see matrix row EF-4); the user must never get
 *       stuck on a per-snippet network error.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
};
const RELAY = relayLenient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return await callBackend("/v2/chat/snippet-followup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error(
      `snippet_followup.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "snippet-followup-v1",
      },
      { status: 500 }
    );
  }
}
