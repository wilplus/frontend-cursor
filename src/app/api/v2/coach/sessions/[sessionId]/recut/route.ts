import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v2/coach/sessions/<session_id>/recut
 *
 * BFF proxy for admin on-demand re-segmentation (E-2 / S7). Re-runs the
 * segmenter on the session's STORED audio (no upload path) and returns the new
 * snippets. Thin pass-through; the BE reuses its existing segment-into-snippets
 * pipeline (segment_into_snippets + apply_extracted_snippets). Coach-gated
 * server-side (require_admin_or_coach + this-coach-owns-the-session). Segmenting
 * can take a while, so the inner abort is generous (55s under Vercel's 60s).
 *
 * 200 → { snippets: [...] } | { count } (BE-defined). The FE refetches the
 * session after a success rather than trusting the returned shape.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const sid = encodeURIComponent(params.sessionId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/sessions/${sid}/recut`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { code: "UPSTREAM_TIMEOUT", error: "Re-cut took too long. Try again in a moment." },
        { status: 504 }
      );
    }
    console.error("POST /api/v2/coach/sessions/[sessionId]/recut — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Re-cut service unavailable." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await upstream.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          code: "UPSTREAM_NON_JSON",
          error: `Unexpected backend response (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}
