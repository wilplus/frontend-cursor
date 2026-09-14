import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/best-presentation
 *
 * BFF proxy — returns the assembled best-presentation payload for an arc:
 * { ready, progress, slides[], presentation_ref }.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Best-presentation service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

/** Retirement watch (founder, 2026-09-14): the deck-ref fallback in
 *  useArcDeckRef marks its GET with `?source=deck-ref-fallback`. The marker is
 *  logged here and forwarded so the backend logs it as well; a day without a
 *  hit retires the fallback. */
const FALLBACK_SOURCE = "deck-ref-fallback";

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  const source = req.nextUrl.searchParams.get("source");
  const marked = source === FALLBACK_SOURCE;
  if (marked) console.warn(`[${FALLBACK_SOURCE}] best-presentation GET for arc ${id}`);
  const query = marked ? `?source=${FALLBACK_SOURCE}` : "";
  return callBackend(`/v2/explore/arc/${id}/best-presentation${query}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
