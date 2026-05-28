import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * PATCH /api/v2/admin/sessions/[sessionId]/kpi-narrative
 *
 * BFF proxy for the session-level "AI commentary" save (Performance
 * summary card on admin Tab 1). Forwards the JSON request body to
 * `PATCH /v2/admin/sessions/<id>/kpi-narrative` on the backend,
 * returns the response verbatim including the 422 EDIT_TOO_SMALL
 * envelope so the page can surface the server's error copy.
 *
 * Request body shape (mirrors the per-snippet comment gate):
 *   {
 *     session_kpi_narrative: string,
 *     ai_draft_baseline:     string | null,
 *     is_trivial_edit:       boolean
 *   }
 *
 * Success response shape:
 *   { session_kpi_narrative: string }
 *
 * Gate failure response shape (HTTP 422):
 *   {
 *     code:        "EDIT_TOO_SMALL",
 *     error:       "Too small a change…",
 *     diff_count:  number,
 *     threshold:   number
 *   }
 */
export async function PATCH(
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

    const bodyText = await req.text();
    const sessionId = encodeURIComponent(params.sessionId);

    const upstream = await fetch(
      `${backend}/v2/admin/sessions/${sessionId}/kpi-narrative`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: bodyText,
        cache: "no-store",
      }
    );

    const text = await upstream.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json(
          {
            code: "UPSTREAM_NON_JSON",
            error: `Unexpected backend response (HTTP ${upstream.status}).`,
          },
          { status: upstream.status >= 400 ? upstream.status : 502 }
        );
      }
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error(
      "PATCH /api/v2/admin/sessions/[id]/kpi-narrative error:",
      name,
      message,
      err
    );
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}` },
      { status: 500 }
    );
  }
}
