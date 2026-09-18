import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v2/voice-album/practice-answer
 *
 * BFF proxy — the owner's five-state answer on one of their own pending
 * clips. Body { arc_id, take_session_id, snippet_id, response } passed
 * through verbatim; the backend rejects anything outside the five states
 * rather than coercing it, so none of them is flattened in transit.
 *
 * The answer is owner routing on that exact recording — never a blind peer
 * label, never a coach judgment. Only a `yes` can help a moment into the
 * Voice Album, and only alongside the machine and coach legs.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const res = await callBackend("/v2/voice-album/practice-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
