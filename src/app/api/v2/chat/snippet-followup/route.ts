import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(`${backend}/v2/chat/snippet-followup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST /api/v2/chat/snippet-followup error:", name, message, err);
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
