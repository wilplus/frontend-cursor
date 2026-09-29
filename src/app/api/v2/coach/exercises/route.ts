import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET/POST /api/v2/coach/exercises
 *
 * BFF proxy for exercise authoring in the coach panel (founder 2026-09-29,
 * decision 4). Verbatim pass-through to `/v2/coach/exercises`.
 *
 * Authorization is server-enforced upstream by `require_admin_or_coach`. The
 * same library is also editable from the CMS under the shared admin password,
 * which a coach does not have; this is the coach's door, and both call the
 * same catalogue service so its refusals hold either way.
 *
 * The upstream status is relayed verbatim because each one is a sentence an
 * author can act on:
 *   200 { exercises, speaking_errors } (GET) · 200 { exercise, version } (POST)
 *   400 — a refusal, readable (an id that would match nothing, a tag no
 *         detector can find, an exercise with no video)
 *   403 — caller is not a coach
 *   502 — backend unavailable
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Exercise library unavailable." } },
};
const RELAY = relayLenient();

export async function GET(_req: NextRequest) {
  return callBackend("/v2/coach/exercises", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return callBackend("/v2/coach/exercises", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    failures: FAILURES,
    relay: RELAY,
  });
}
