import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { callBackend, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/corpus/mixed-queue[?start=<session_id>]
 *   → BE GET /v2/coach/corpus/mixed-queue
 *
 * The training corpus judged mixed (founder 2026-10-21, N101): the next
 * round of clips across imports, never one speaker twice in a row, the
 * machine's reads in equal measure, in a blind order. `start` is the import
 * the coach opened, whose clip comes first; anything but a UUID is dropped.
 *
 *   200 { session_id, queue: [{snippet_id, label, re_review, rating_locked,
 *         rating_lock_reason, learning_exposures, topic}], count, labelled }
 *   400 · 401/403 · 428 (no languages) · 500
 *
 * COACH/ADMIN ONLY; the role gate is upstream. Never cached: the round moves
 * with every answer.
 */
const UUID = /^[0-9a-fA-F-]{36}$/;
const RELAY = relayLenient();

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start");
  const qs = start && UUID.test(start) ? `?start=${encodeURIComponent(start)}` : "";
  const response = await callBackend(`/v2/coach/corpus/mixed-queue${qs}`, { method: "GET", relay: RELAY });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response as NextResponse;
}
