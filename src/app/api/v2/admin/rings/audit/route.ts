import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  /api/v2/admin/rings/* — the founder's rollout panel (backend 0392).        */
/*                                                                            */
/*  CARRIES NO SECRET: it forwards only the caller's JWT and the backend's     */
/*  @require_admin is the gate; a non-admin gets the 403 passed through.       */
/*  Query keys are allowlisted where a query exists. Every write goes to one   */
/*  SECURITY DEFINER RPC upstream; nothing here decides a ring, a kill or a    */
/*  consent (rings decide reach, never provenance).                            */
/* -------------------------------------------------------------------------- */
// Auth is demanded by callBackend's default; the failure envelopes are the
// helper's own defaults, so no new user-facing string is minted here (copy is
// founder-held). The envelope is pinned in bffEnvelopes.golden.json.
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const src = req.nextUrl.searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["limit"]) {
    const value = src.get(key);
    if (value) forwarded.set(key, value);
  }
  const qs = forwarded.toString();
  const res = await callBackend(`/v2/admin/rings/audit${qs ? `?${qs}` : ""}`, { method: "GET", relay: RELAY });
  // A cached ring is a wrong ring — this panel exists to move it.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
