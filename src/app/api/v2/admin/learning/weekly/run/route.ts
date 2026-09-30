import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export const maxDuration = 60;

/* POST /api/v2/admin/learning/weekly/run — run the weekly job now (founder
 * only, ML-3). Forwards the JWT; the backend's @require_founder is the gate. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const res = await callBackend("/v2/admin/learning/weekly/run", { method: "POST", relay: RELAY });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
