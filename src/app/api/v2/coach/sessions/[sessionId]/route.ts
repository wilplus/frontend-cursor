import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/coach/sessions/<session_id>
 *
 * BFF proxy for the per-session review payload (§B.2). Verbatim pass-through
 * to `GET /v2/coach/sessions/<id>` on the BE.
 *
 * Authorization is server-enforced via `require_admin_or_coach` upstream.
 * The payload is identity-stripped at the BE — never `name`/`email`, just
 * pseudonym + domain + snippet array with persisted coach_state for resume
 * (E1). The FE never has to filter — it just renders what arrives.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

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

    const id = encodeURIComponent(params.sessionId);
    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/coach/sessions/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch (err) {
      console.error("coach_session.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Coach session service unavailable." },
        { status: 502 }
      );
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_session.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-session-v1",
      },
      { status: 500 }
    );
  }
}
