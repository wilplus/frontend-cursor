import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/research/golden — the golden sets' counts (ML-7). Forwards the
 * JWT; the backend's @require_research_read is the gate. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const res = await callBackend("/v2/research/golden", { method: "GET", relay: RELAY });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
