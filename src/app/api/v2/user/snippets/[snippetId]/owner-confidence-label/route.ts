import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/* -------------------------------------------------------------------------- */
/*  PUT /api/v2/user/snippets/[snippetId]/owner-confidence-label               */
/*    → BE PUT /v2/user/snippets/<snippet_id>/owner-confidence-label           */
/*                                                                            */
/*  The ideal-text modal's blind label (founder 2026-08-10: "the modal in     */
/*  the ideal text has an option to label the voice snippet"). The OWNER's    */
/*  lane of the same ternary instrument every other lane writes —             */
/*  { value: "yes"|"no"|"neutral" } XOR { unrateable: true }, plus note /     */
/*  latency_ms. Coach + owner are the two labels that admit a snippet to      */
/*  the game ("min twice labelled").                                          */
/*                                                                            */
/*  Relayed VERBATIM — the BE owns validation (a coerced value would          */
/*  fabricate training data). Auth REQUIRED: the label must be attributable   */
/*  and the BE ownership-gates the snippet to the caller.                     */
/*                                                                            */
/*  Success 200: { saved: true, snippet_id }                                  */
/*  401 UNAUTHENTICATED · 404 not the caller's snippet · 5xx unavailable      */
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
        `${backend}/v2/user/snippets/${id}/owner-confidence-label`,
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
      console.error("owner_confidence_label.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Label service unavailable." },
        { status: 502 }
      );
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error(
      `owner_confidence_label.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "owner-confidence-label-v1",
      },
      { status: 500 }
    );
  }
}
