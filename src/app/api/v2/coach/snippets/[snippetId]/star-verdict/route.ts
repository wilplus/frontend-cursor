import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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

export async function PUT(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
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
    const id = encodeURIComponent(params.snippetId);
    const body = await req.text();
    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/coach/snippets/${id}/star-verdict`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: body || "{}",
        cache: "no-store",
      });
    } catch (err) {
      console.error("coach_star_verdict.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Star verdict service unavailable." },
        { status: 502 }
      );
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
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
