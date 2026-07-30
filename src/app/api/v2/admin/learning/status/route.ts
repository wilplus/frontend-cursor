import { NextRequest } from "next/server";
import { proxyLearningGet } from "../proxy";

export const runtime = "nodejs";

/** GET /api/v2/admin/learning/status — passthrough for the shadow-learning
 * corpus/model snapshot (@require_admin_or_coach upstream). */
export async function GET(req: NextRequest) {
  return proxyLearningGet(req, "/v2/admin/learning/status");
}
