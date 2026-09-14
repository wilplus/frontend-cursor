import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/coaching/intro-bubble
 *
 * Closes out the snippet-labeling chain (matrix LI-4) by fetching a
 * personalized intro line that bridges from "you just answered the
 * follow-up reflection" into "now record a fresh take." The user-
 * facing chat surface auto-appends the returned `intro_text` as an
 * assistant bubble, then swaps the panel into `recording_ready`
 * mode (big mic).
 *
 * Backend contract (per prompt C3): the endpoint MUST return 200
 * with a usable `intro_text` even on its own internal LLM failure —
 * the BE keeps a static fallback. A non-200 from this route means a
 * real outage; the caller renders a hard-coded FE fallback line so
 * the user never sees a dead end.
 *
 * Body: { snippet_id: string }
 * Response 200: { intro_text: string, debug?: object }
 * 401 UNAUTHENTICATED
 * 5xx — proxy / network failure; FE shows static fallback.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "The coach took too long to write the intro." } },
};
const RELAY = relayLenient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // 25s inner budget — 5s headroom under maxDuration so the abort
    // fires BEFORE Vercel slams the door and we return a proper
    // UPSTREAM_TIMEOUT JSON instead of Vercel's generic edge 502.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    try {
      return await callBackend("/v2/coaching/intro-bubble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
        failures: FAILURES,
        relay: RELAY,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `intro_bubble.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "intro-bubble-v1",
      },
      { status: 500 }
    );
  }
}
