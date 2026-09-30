import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/admin/learning/ledger — the founder's pace panel (ML-4).       */
/*                                                                            */
/*  CARRIES NO SECRET: forwards the caller's JWT; the backend's                */
/*  @require_founder is the gate and a non-founder gets its 403 through.      */
/*  AC-9: counts about the machine, for the founder alone; never proxied to   */
/*  a speaker's surface.                                                      */
/* -------------------------------------------------------------------------- */
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const res = await callBackend("/v2/admin/learning/ledger", { method: "GET", relay: RELAY });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
