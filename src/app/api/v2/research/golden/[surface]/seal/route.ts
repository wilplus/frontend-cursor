import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* POST /api/v2/research/golden/:surface/seal — seal the founder's golden set
 * once, at fifty (ML-7, L6). The backend's @require_founder is the gate and
 * refuses under fifty (GOLDEN_SET_INCOMPLETE) or a second seal (SEALED). */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(_req: NextRequest, { params }: { params: { surface: string } }): Promise<NextResponse> {
  return callBackend(`/v2/research/golden/${encodeURIComponent(params.surface)}/seal`, { method: "POST", relay: RELAY });
}
