import { NextRequest } from "next/server";
import { proxyLearningGet } from "../proxy";

export const runtime = "nodejs";

/**
 * GET /api/v2/admin/learning/trace — BFF proxy for the developer
 * learning-trace (backlog item 11). ADMIN-ONLY upstream (@require_admin,
 * not admin-or-coach: BLIND COACH — the payload shows machine guesses vs
 * coach labels). Rendered by /admin/learning.
 */
export async function GET(req: NextRequest) {
  return proxyLearningGet(req, "/v2/admin/learning/trace");
}
