import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

const BFF_REVISION = "admin-snippet-delete-v1";

/**
 * DELETE /api/v2/admin/snippets/[snippetId]
 *
 * Hard-deletes a snippet (and its dependent rows on the backend —
 * follow_up_outcome, coaching attempts, evaluator metadata, etc.).
 * Used by the destructive "Delete" button on the admin snippet
 * card. Frontend optimistically removes the snippet from the
 * snippets[] state on 200; no follow-up GET.
 *
 * Proxies to backend DELETE /v2/admin/snippets/<id>.
 *
 * 200 OK   — snippet deleted (returns whatever backend sends, but
 *             frontend doesn't read the body — it already removed
 *             the row from local state)
 * 401      — admin not signed in
 * 403      — caller isn't an admin
 * 404      — snippet missing or already deleted (frontend treats
 *             this as a successful no-op since the snippet is
 *             effectively gone)
 * 5xx      — backend unavailable; frontend keeps the snippet in
 *             local state and surfaces the error toast
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function DELETE(
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

    const upstream = await fetch(
      `${backend}/v2/admin/snippets/${encodeURIComponent(snippetId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "x-bff-revision": BFF_REVISION,
        },
        cache: "no-store",
      }
    );

    // Backend may return 204 with no body or 200 with a small ack;
    // both are fine. We forward status verbatim and parse body
    // defensively so a 204 doesn't blow up on .json().
    const text = await upstream.text();
    const data = text ? safeParse(text) : { status: "ok" };
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("DELETE snippet API error:", name, message, err);
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

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { status: "ok", raw: text };
  }
}
