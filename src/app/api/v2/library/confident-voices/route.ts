import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/library/confident-voices
 *
 * BFF proxy for the user's Confident Voices library (F2 §1e): cross-project,
 * coach-verified moments only, newest first. AC-9 standing rule holds through
 * this proxy — no counts, no streaks, no aggregates; a list is a list.
 */
export async function GET(_req: NextRequest) {
  return callBackend("/v2/library/confident-voices", { method: "GET" });
}
