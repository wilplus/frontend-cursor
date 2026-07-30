import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * Shared GET proxy for the /v2/admin/learning/* BFF passthroughs
 * (trace / status / models). Forwards the Supabase JWT verbatim; the
 * BACKEND is the gate (@require_admin on /trace — BLIND COACH: the trace
 * is admin-only; @require_admin_or_coach on status/models). Non-admins get
 * the backend's 403 passed straight through. Developer observability only —
 * nothing here is ever user-facing (AC-9).
 */
export async function proxyLearningGet(req: NextRequest, upstreamPath: string) {
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

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}${upstreamPath}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error(`GET ${upstreamPath} — fetch failed:`, err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Learning service unavailable." },
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
