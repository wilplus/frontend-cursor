import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* GET /api/v2/research/golden/:surface/next — the next moment for the founder
 * to judge (ML-7, L6). The backend's @require_founder is the gate; the moment
 * carries a passage and a signed clip, no label and no machine read. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest, { params }: { params: { surface: string } }): Promise<NextResponse> {
  const res = await callBackend(`/v2/research/golden/${encodeURIComponent(params.surface)}/next`, { method: "GET", relay: RELAY });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
