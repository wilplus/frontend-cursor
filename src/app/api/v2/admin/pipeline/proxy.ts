import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * Shared proxy for the /v2/admin/pipeline/* BFF passthroughs
 * (health / jobs / sweep).
 *
 * THIS FILE CARRIES NO SECRET, AND THAT IS THE DESIGN.
 *
 * The queue's cron endpoints (/v2/internal/jobs/*) are gated by
 * `X-Internal-Secret: PIPELINE_JOBS_SWEEP_SECRET`. The obvious way to build an
 * admin panel is to have this proxy hold that secret server-side and attach
 * it. That does keep the secret out of the browser — but it makes this file a
 * secret-laundering proxy: its own admin check would become the only thing
 * between a caller and a machine credential that bypasses all user
 * authorization, and getting that check wrong leaks the secret while every log
 * line still looks fine.
 *
 * So the backend grew @require_admin TWINS instead, calling the same services.
 * This proxy forwards the Supabase JWT verbatim and THE BACKEND IS THE GATE —
 * the same shape as ../learning/proxy.ts. Non-admins get the backend's 403
 * passed straight through. The secret is not merely hidden from the browser;
 * it is never involved in this path at all, so there is nothing here to leak.
 *
 * AC-9: plumbing counters about JOBS (status, stage, attempts, timings), never
 * reads on a speaker. Admin-only, never rendered on a student surface.
 */
export async function proxyPipeline(
  req: NextRequest,
  upstreamPath: string,
  method: "GET" | "POST" = "GET"
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

  // Only the query string the panel actually uses is forwarded. Passing
  // req.nextUrl.search through wholesale would let a caller append arbitrary
  // params to an admin endpoint, and the allowlist is cheap.
  const src = req.nextUrl.searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["status", "limit", "before"]) {
    const value = src.get(key);
    if (value) forwarded.set(key, value);
  }
  const qs = forwarded.toString();
  const url = `${backend}${upstreamPath}${qs ? `?${qs}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error(`${method} ${upstreamPath} — fetch failed:`, err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Pipeline service unavailable." },
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
  const res = NextResponse.json(data, { status: upstream.status });
  // A cached queue depth is a wrong queue depth.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
