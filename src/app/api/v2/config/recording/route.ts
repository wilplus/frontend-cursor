import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/config/recording
 *
 * BFF proxy for the recording product constants (BE, 2026-07-27). Today that
 * is `long_take_caution_sec` — the length at or above which the setup flow
 * offers its soft caution (FE-5).
 *
 * It lives here rather than being echoed on the arc's /setup payload on
 * purpose: it is a PRODUCT constant, not a project field, and a pinned test
 * keeps that payload minimal. Read once at boot; never hardcode the number.
 *
 * Relayed verbatim, including the status.
 */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/config/recording`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/config/recording — fetch failed:", err);
    return NextResponse.json({ error: "Config service unavailable." }, { status: 502 });
  }

  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
