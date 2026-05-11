import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/admin/snippets/[snippetId]/comment
 *
 * Admin endpoint to update a snippet's admin_comment + snippet_type and,
 * optionally, the follow_up_question. Proxies to backend
 * POST /v2/admin/snippets/<id>/comment.
 *
 * Previously read `process.env.NEXT_PUBLIC_BACKEND_URL` directly with a
 * `localhost:5000` fallback — that variable isn't set on Vercel (we use
 * BACKEND_URL_INTERNAL / BACKEND_URL there), so every admin save in
 * production silently posted to localhost and returned 500. Same fix
 * pattern we applied to the user-level snippets BFF (commit 055c4de) and
 * the bounds / skip / finalize-recording BFFs: route through
 * getBackendUrl() and getV2AccessToken() so the URL resolution + auth
 * extraction match the rest of the admin surface.
 */
export async function POST(
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

    const body = await req.json().catch(() => ({}));

    const response = await fetch(
      `${backend}/v2/admin/snippets/${snippetId}/comment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    // Self-identifying tag + surfaced error message so a 500 here is
    // immediately diagnosable. Before this change the BFF's catch
    // returned a generic shape identical to the pre-migration version,
    // making "is the new deploy live?" impossible to answer from the
    // response alone. The `bff_revision` field flips that.
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("Update snippet comment API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "snippet-comment-3cfa79f+",
      },
      { status: 500 }
    );
  }
}
