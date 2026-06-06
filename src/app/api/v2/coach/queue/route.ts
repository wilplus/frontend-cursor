import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/coach/queue
 *
 * BFF proxy for the coach review queue (§B.1). Verbatim pass-through
 * to `GET /v2/coach/queue` on the BE — no FE reshape.
 *
 * Authorization is server-enforced on the BE via `require_admin_or_coach`.
 * Non-coach users get 403 from upstream; the FE service treats that as
 * "no queue to show" and renders nothing. Surface-level FE `is_coach`
 * is render-only — the real boundary lives here on the upstream auth gate.
 *
 * Returns the BE body verbatim (whatever shape it ships):
 *   200 { items: [{ session_id, pseudonym, domain, topic, n_snippets,
 *                   state, sent_at }, ...] }  // expected
 *   401 / 403 — caller is not a coach
 *   404 — endpoint not yet shipped on BE (FE service falls through to [])
 *   502 — backend unavailable
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/coach/queue`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch (err) {
      console.error("coach_queue.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Coach queue service unavailable." },
        { status: 502 }
      );
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_queue.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-queue-v1",
      },
      { status: 500 }
    );
  }
}
