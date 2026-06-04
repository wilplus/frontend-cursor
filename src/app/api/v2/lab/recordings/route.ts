import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/lab/recordings
 *
 * BFF proxy for the willab Lab upload (§3.3). Multipart pass-through: forwards
 * the raw body + Content-Type (boundary preserved) to the backend. SYNCHRONOUS
 * upstream (~3–5s) — returns 201 + the finished Readout, or 422 (min-content
 * gate: <60s / no-speech → re-record). PUBLIC / guest — auth is forwarded when
 * present (signed-in scoping) but never required here.
 *
 * Verbatim status + JSON pass-through so the FE client owns the envelope shape.
 */
const UPSTREAM = "/v2/lab/recordings";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  // Optional auth — the Lab upload is public/guest; forward the token if signed.
  const token = await getV2AccessToken(req);
  const contentType =
    req.headers.get("content-type") ?? "application/octet-stream";
  const body = await req.arrayBuffer();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}${UPSTREAM}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/lab/recordings — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Lab service unavailable." },
      { status: 502 }
    );
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
