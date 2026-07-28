import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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
      upstream = await fetch(
        `${backend}/v2/coach/snippets/${id}/confidence-label`,
        {
          method: "PUT",
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
      console.error("coach_confidence_label.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Label service unavailable." },
        { status: 502 }
      );
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
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
