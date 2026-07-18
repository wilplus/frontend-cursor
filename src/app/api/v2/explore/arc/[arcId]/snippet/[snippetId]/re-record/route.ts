import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/explore/arc/<arc_id>/snippet/<snippet_id>/re-record
 *
 * DELIVERY_STARS — a per-snippet re-record: the user reads just that fragment
 * again to apply a delivery observation (slower / more emphasis / a breath),
 * and the BE re-transcribes + re-analyzes that one snippet and folds the
 * improved take into the living ideal text.
 *
 * Multipart pass-through to POST /v2/explore/arc/<id>/snippet/<nid>/re-record.
 * Body: audio_file (binary), duration_seconds (optional).
 *
 * SAFE-AHEAD: this BE endpoint is not built yet. Until it ships, upstream 404s
 * and the FE surfaces a soft retry — never a broken state. Guest-capable (the
 * explore lane runs on the cookie session), so a missing bearer is NOT a hard
 * 401: forward the token when present and let the BE scope by session.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; snippetId: string } }
) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json(
        { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
        { status: 400 }
      );
    }
    const out = new FormData();
    for (const [key, value] of inbound.entries()) out.append(key, value);

    const headers: Record<string, string> = { Accept: "application/json" };
    const token = await getV2AccessToken(req);
    if (token) headers.Authorization = `Bearer ${token}`;
    const cookie = req.headers.get("cookie");
    if (cookie) headers.cookie = cookie;

    const aid = encodeURIComponent(params.arcId);
    const nid = encodeURIComponent(params.snippetId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    let upstream: Response;
    try {
      upstream = await fetch(
        `${backend}/v2/explore/arc/${aid}/snippet/${nid}/re-record`,
        {
          method: "POST",
          headers,
          body: out,
          signal: controller.signal,
          cache: "no-store",
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { code: "UPSTREAM_TIMEOUT", error: "Upload took too long. Try again." },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${message}` },
      { status: 500 }
    );
  }
}
