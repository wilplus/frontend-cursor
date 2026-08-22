import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/coach/sessions/<session_id>/snippets/<snippet_id>
 *
 * BFF proxy for per-snippet draft save (§B.3). Verbatim pass-through to
 * `POST /v2/coach/sessions/<sid>/snippets/<sid>` on the BE.
 *
 * Body accepts any subset of:
 *   { note?, tag?, surfaced? }
 *
 * USER LANE ONLY — note/tag/surfaced → insights_payload (library-bound).
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

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } }
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
    const nid = encodeURIComponent(params.snippetId);
    const body = await req.text();

    let upstream: Response;
    try {
      upstream = await fetch(
        `${backend}/v2/coach/sessions/${sid}/snippets/${nid}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: body || "{}",
          cache: "no-store",
        }
      );
    } catch (err) {
      console.error("coach_snippet_save.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        {
          code: "PROXY_ERROR",
          error: "Coach snippet save service unavailable.",
        },
        { status: 502 }
      );
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
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
