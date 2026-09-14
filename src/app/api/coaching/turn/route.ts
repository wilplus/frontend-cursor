import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/coaching/turn
 *
 * Run one LLM turn against the awareness-stage system prompt. Proxies
 * to `POST /v2/coaching/turn`. The backend parses the LLM's
 * `acknowledgment ||| question [ADVANCE]` output, advances the stage
 * when [ADVANCE] is present, and returns ready-to-render bubbles.
 *
 * Body: { coaching_id: string, user_message: string }
 *
 * 200: { bubbles: [string, string], advance: boolean,
 *        next_stage: "awareness" | "trial" | "complete" }
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Sign-in required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coach is unavailable. Please try again." } },
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

  return callBackend("/v2/coaching/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    token,
    failures: FAILURES,
    relay: RELAY,
  });
}
