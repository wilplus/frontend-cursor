import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/voice-album/practice-queue
 *
 * BFF proxy — the clips still waiting for the owner's Confident Voice answer
 * ("Practice new"), in project order, then Take, then slide. The backend owns
 * that ordering; nothing here re-sorts.
 *
 * Data only, AC-9-clean: playback and position, never a score or a machine
 * read. `general_available: false` means the coach-uploaded shared corpus is
 * a Phase-2 path that is not served yet — not that the queue is finished.
 */
export async function GET(): Promise<NextResponse> {
  const res = await callBackend("/v2/voice-album/practice-queue", {
    method: "GET",
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
