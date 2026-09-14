import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v2/coach/sessions/<session_id>/recut
 *
 * BFF proxy for admin on-demand re-segmentation (E-2 / S7). Re-runs the
 * segmenter on the session's STORED audio (no upload path) and returns the new
 * snippets. Thin pass-through; the BE reuses its existing segment-into-snippets
 * pipeline (segment_into_snippets + apply_extracted_snippets). Coach-gated
 * server-side (require_admin_or_coach + this-coach-owns-the-session). Segmenting
 * can take a while, so the inner abort is generous (55s under Vercel's 60s).
 *
 * 200 → { snippets: [...] } | { count } (BE-defined). The FE refetches the
 * session after a success rather than trusting the returned shape.
 *
 * 409 RECUT_WOULD_DISCARD_COACH_WORK { drafts } (BE-6) — the session has
 * review work and ?force=true was absent. This route forwards the ?force flag
 * and passes the upstream status + body through unchanged, so the FE can read
 * the counts, confirm, and re-call with ?force=true to discard + proceed.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Re-cut service unavailable." } },
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Re-cut took too long. Try again in a moment." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sid = encodeURIComponent(params.sessionId);
  // BE-6 — forward ?force=true so a coach-confirmed re-cut can discard the
  // orphaned labels/drafts the BE would otherwise 409 on.
  const force =
    req.nextUrl.searchParams.get("force") === "true" ? "?force=true" : "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);
  try {
    return await callBackend(`/v2/coach/sessions/${sid}/recut${force}`, {
      method: "POST",
      signal: controller.signal,
      failures: FAILURES,
      relay: RELAY,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
