import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

export const runtime = "nodejs";
/**
 * Same LLM latency profile as /api/public/interview/next-question —
 * 25s upstream budget with 5s Vercel headroom.
 */
export const maxDuration = 30;

/**
 * POST /api/v2/public/interview/contextual-next-question
 *
 * BFF proxy for the post-tester-feedback contextual question engine.
 * Replaces the old /next-question path for turns 2+ (turn 1 still
 * uses the canonical opener fallback — see fetchNextQuestion in
 * public-client.ts).
 *
 * Body forwarded verbatim to BE:
 *   {
 *     guest_session_id?: string   // absent on turn 1 (no session yet)
 *     turn_number:       number
 *     previous_turns:    [{ question: string, transcript?: string }]
 *   }
 *
 * Response 200 (superset of InterviewQuestion):
 *   {
 *     question:          string
 *     target_intent:     "charisma" | "stress"
 *     bridge_to?:        string   // e.g. "user mentioned cycling"
 *     source:            "contextual_llm" | "contextual_llm_fallback"
 *     completion_state:  { ready, criteria, current }
 *     // legacy fields preserved for back-compat:
 *     tone?:             "charisma" | "stress"
 *     turn_number?:      number
 *   }
 *
 * The FE treats this identically to the old response shape — extra
 * fields (target_intent, bridge_to, source) are passed through for
 * attribution logging but not rendered to the user.
 */
export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const url = `${backend}/v2/public/interview/contextual-next-question`;

  let upstream: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        {
          code: "UPSTREAM_TIMEOUT",
          error:
            "The coach took too long to think. Refresh to retry — if " +
            "this keeps happening, backend logs will show which call hung.",
        },
        { status: 504 }
      );
    }
    return NextResponse.json(
      {
        code: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to reach backend.",
      },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { code: "INVALID_RESPONSE", error: "Backend returned invalid JSON." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(json, { status: upstream.status });
}
