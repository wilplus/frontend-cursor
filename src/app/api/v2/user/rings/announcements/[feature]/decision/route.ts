import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  POST /api/v2/user/rings/announcements/[feature]/decision                   */
/*  The person's answer to an announcement: {decision: "accepted"|"not_now"}. */
/*  It records an answer and NOTHING else — no consent is created here (L3);  */
/*  the consent screens record consent and the feature turns on only when the */
/*  backend sees it.                                                          */
/* -------------------------------------------------------------------------- */
// Auth is demanded by callBackend's default; the failure envelopes are the
// helper's own defaults, so no new user-facing string is minted here (copy is
// founder-held). The envelope is pinned in bffEnvelopes.golden.json.
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest, { params }: { params: { feature: string } }): Promise<NextResponse> {
  const body = await req.text();
  const res = await callBackend(`/v2/user/rings/announcements/${encodeURIComponent(params.feature)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
    relay: RELAY,
  });
  // A cached ring is a wrong ring — this panel exists to move it.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
