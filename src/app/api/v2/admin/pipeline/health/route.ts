import { NextRequest } from "next/server";
import { proxyPipeline } from "../proxy";

export const runtime = "nodejs";

/** GET /api/v2/admin/pipeline/health — queue depth, latency percentiles and
 * the saturation verdict (@require_admin upstream). */
export async function GET(req: NextRequest) {
  return proxyPipeline(req, "/v2/admin/pipeline/health");
}
