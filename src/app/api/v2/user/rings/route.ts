import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  /api/v2/user/rings — what is on for the signed-in person and which        */
/*  announcements are pending for them (backend 0392). Read at login by the   */
/*  announcement sheet and by the hooks that decide whether a ringed overlay   */
/*  lane mounts. Carries the person's own ring and feature list, never a      */
/*  score or anyone else's row. @require_auth backend-side.                    */
/* -------------------------------------------------------------------------- */
// Auth is demanded by callBackend's default; the failure envelopes are the
// helper's own defaults, so no new user-facing string is minted here (copy is
// founder-held). The envelope is pinned in bffEnvelopes.golden.json.
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const res = await callBackend("/v2/user/rings", { method: "GET", relay: RELAY });
  // A cached ring is a wrong ring — this panel exists to move it.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
