import { NextRequest } from "next/server";
import { proxyPipeline } from "../proxy";

export const runtime = "nodejs";

/** GET /api/v2/admin/pipeline/jobs — recent jobs, newest first
 * (@require_admin upstream). Supports ?status= &limit= &before=. */
export async function GET(req: NextRequest) {
  return proxyPipeline(req, "/v2/admin/pipeline/jobs");
}
