import { NextRequest } from "next/server";
import { proxyPipeline } from "../proxy";

export const runtime = "nodejs";

/** POST /api/v2/admin/pipeline/sweep — recover jobs the queue lost track of
 * (@require_admin upstream). CAS-guarded and safe to press repeatedly. */
export async function POST(req: NextRequest) {
  return proxyPipeline(req, "/v2/admin/pipeline/sweep", "POST");
}
