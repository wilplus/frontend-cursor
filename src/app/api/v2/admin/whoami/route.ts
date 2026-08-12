import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/admin/whoami — 200 {admin:true} or the backend's 403.          */
/*                                                                            */
/*  The probe every admin page renders behind. Carries no secret: it forwards  */
/*  only the caller's JWT, and @require_admin upstream is the gate. Passing    */
/*  the 403 through verbatim is the point — the page needs to distinguish      */
/*  "not an admin" from "the backend is unreachable", and only the status      */
/*  carries that.                                                             */
/* -------------------------------------------------------------------------- */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const res = await callBackend("/v2/admin/whoami", { method: "GET" });
  // A cached admin verdict is how a revoked admin keeps their panel.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
