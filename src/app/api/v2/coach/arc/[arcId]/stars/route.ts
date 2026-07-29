import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/coach/arc/[arcId]/stars → BE GET /v2/coach/arc/<arc_id>/stars  */
/*                                                                            */
/*  The coach's star-review list: every machine-fired star on the arc, with    */
/*  any saved verdicts. COACH-ONLY data — authorization is enforced upstream   */
/*  (require_admin_or_coach); the FE `is_coach` flag is render-only, so this   */
/*  proxy adds no gate of its own and passes 401/403/404 through verbatim.     */
/*  Body is relayed untouched: the BFF never reshapes coach payloads.          */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
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
    const id = encodeURIComponent(params.arcId);
    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/coach/arc/${id}/stars`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
    } catch (err) {
      console.error("coach_arc_stars.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Star review service unavailable." },
        { status: 502 }
      );
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_arc_stars.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-arc-stars-v1",
      },
      { status: 500 }
    );
  }
}
