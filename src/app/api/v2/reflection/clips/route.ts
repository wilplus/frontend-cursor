import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/reflection/clips
 *
 * BFF proxy for the Reflection Game's clip serve (F2 §1b). The BE is the
 * cadence authority (≤2 freshly-served clips per day) and the payload is its
 * explicit allowlist — nothing here may add fields, because the network tab
 * is a user surface and decoy identity must never reach it.
 */
export async function GET(_req: NextRequest) {
  return callBackend("/v2/reflection/clips", { method: "GET" });
}
