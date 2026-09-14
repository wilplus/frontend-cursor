import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/students/<user_id>
 *
 * BFF proxy for the coach's per-student drill-down (E-1b / S6). Pseudonymized
 * upstream — { pseudonym, domain, goal, sessions[] }, never the user's real
 * name or email (§B.4 / §14 red-line 6). `goal` is the user's free-text and may
 * self-identify (same caveat as transcripts) — that's inherent, not scrubbable.
 * Coach-gated server-side (require_admin_or_coach); 403 → FE soft-fails to null.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Student service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const uid = encodeURIComponent(params.userId);
  return callBackend(`/v2/coach/students/${uid}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
