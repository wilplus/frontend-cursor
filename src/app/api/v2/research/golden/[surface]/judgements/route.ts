import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* POST /api/v2/research/golden/:surface/judgements — one founder judgement
 * (ML-7, L6). Body passed through; the backend's @require_founder is the gate. */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest, { params }: { params: { surface: string } }): Promise<NextResponse> {
  return callBackend(`/v2/research/golden/${encodeURIComponent(params.surface)}/judgements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
    relay: RELAY,
  });
}
