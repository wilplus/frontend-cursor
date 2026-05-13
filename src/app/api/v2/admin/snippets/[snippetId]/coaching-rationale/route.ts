import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

const BFF_REVISION = "admin-snippet-coaching-rationale-v1";

/**
 * PATCH /api/v2/admin/snippets/[snippetId]/coaching-rationale
 *
 * Admin endpoint to persist a (possibly corrected) version of the
 * coaching evaluator's rationale on a snippet's follow_up_outcome.
 * Powers the editable rationale Textarea on the snippet card —
 * admin reviews the AI-drafted rationale, optionally edits it, hits
 * Save. Backend stores both the corrected text AND a flag indicating
 * whether the admin edited it or accepted the AI verbatim:
 *
 *   • edited_by_admin = true  → paired training example
 *                                (AI's draft vs admin's correction)
 *   • edited_by_admin = false → positive example
 *                                (AI got it right, admin approved)
 *
 * The "approved as-is" signal is just as valuable as a correction —
 * the model never learns it's right unless reviewers say so. That's
 * why we POST even when the text matches the original.
 *
 * Proxies to backend PATCH /v2/admin/snippets/<id>/coaching-rationale.
 *
 * Body:
 *   {
 *     rationale: string,           // the (possibly corrected) text
 *     edited_by_admin: boolean,    // true if admin changed the AI draft
 *   }
 *
 * Returns: the updated snippet (or just the updated outcome blob —
 * backend's choice; frontend reads the response and patches local
 * state accordingly).
 *
 * 400 INVALID_INPUT     — empty rationale / wrong shape
 * 401 UNAUTHENTICATED
 * 404 NOT_FOUND         — snippet missing or has no follow_up_outcome
 * 5xx                   — backend unavailable
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  try {
    const snippetId = params.snippetId;
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

    const body = (await req.json().catch(() => ({}))) as {
      rationale?: string;
      edited_by_admin?: boolean;
    };
    if (typeof body.rationale !== "string" || !body.rationale.trim()) {
      return NextResponse.json(
        { code: "INVALID_INPUT", error: "`rationale` must be a non-empty string" },
        { status: 400 }
      );
    }
    if (typeof body.edited_by_admin !== "boolean") {
      return NextResponse.json(
        { code: "INVALID_INPUT", error: "`edited_by_admin` must be a boolean" },
        { status: 400 }
      );
    }

    const upstream = await fetch(
      `${backend}/v2/admin/snippets/${encodeURIComponent(snippetId)}/coaching-rationale`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-bff-revision": BFF_REVISION,
        },
        body: JSON.stringify({
          rationale: body.rationale.trim(),
          edited_by_admin: body.edited_by_admin,
        }),
        cache: "no-store",
      }
    );

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("PATCH coaching-rationale API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: BFF_REVISION,
      },
      { status: 500 }
    );
  }
}
