import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/coaching/start
 *
 * Opens a micro-coaching session on a single snippet. Proxies to
 * `POST /v2/coaching/start` on the Python backend, which validates
 * ownership + presence of admin_comment and creates the
 * coaching_sessions row in the awareness stage.
 *
 * Body: { snippet_id: string }
 *
 * 200: { coaching_id, intent, awareness_message, source_snippet }
 * 401: not signed in
 * 404: snippet missing or not yours
 * 422: snippet has no admin_comment, or charisma intent (v1 stress-only)
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Sign-in required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coaching service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest) {
  // Sign-in is checked before the body is read, as it always was.
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Body must be JSON." },
      { status: 400 }
    );
  }

  return callBackend("/v2/coaching/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    token,
    failures: FAILURES,
    relay: RELAY,
  });
}
