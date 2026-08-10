import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/**
 * Shared proxy for the /v2/admin/pipeline/* BFF passthroughs
 * (health / jobs / sweep).
 *
 * THIS FILE CARRIES NO SECRET, AND THAT IS THE DESIGN.
 *
 * The queue's cron endpoints (/v2/internal/jobs/*) are gated by a shared
 * machine secret. The obvious way to build an admin panel is to have this
 * proxy hold that secret server-side and attach it. That does keep the secret
 * out of the browser — but it makes this file a secret-laundering proxy: its
 * own admin check would become the only thing between a caller and a
 * credential that bypasses all user authorization, and getting that check
 * wrong leaks it while every log line still looks fine.
 *
 * So the backend grew @require_admin TWINS instead, calling the same services.
 * This proxy forwards only the caller's JWT and THE BACKEND IS THE GATE.
 * Non-admins get the backend's 403 passed straight through. The secret is not
 * merely hidden from the browser; it is never involved in this path at all,
 * so there is nothing here to leak.
 *
 * WHY callBackend AND NOT A DIRECT fetch. `npm run check:bff` requires it, and
 * the neighbouring learning proxy only predates the rule (one of 95
 * grandfathered files) — new code does not inherit that exemption. It is also
 * the right call on merit: callBackend owns token lookup, the 401, the
 * backend-not-configured 502 and verbatim status/body passthrough, so this
 * file holds only what is genuinely specific to the pipeline panel.
 *
 * AC-9: plumbing counters about JOBS (status, stage, attempts, timings), never
 * reads on a speaker. Admin-only, never rendered on a student surface.
 */
export async function proxyPipeline(
  req: NextRequest,
  upstreamPath: string,
  method: "GET" | "POST" = "GET"
): Promise<NextResponse> {
  // Only the query keys the panel actually uses are forwarded. Passing the
  // incoming search string through wholesale would let a caller append
  // arbitrary params to an admin endpoint, and the allowlist is cheap.
  const src = req.nextUrl.searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["status", "limit", "before"]) {
    const value = src.get(key);
    if (value) forwarded.set(key, value);
  }
  const qs = forwarded.toString();

  const res = await callBackend(`${upstreamPath}${qs ? `?${qs}` : ""}`, {
    method,
  });
  // A cached queue depth is a wrong queue depth.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
