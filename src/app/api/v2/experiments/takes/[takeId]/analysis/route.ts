import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** GET /v2/experiments/takes/<id>/analysis. 202 while it is queued, 200
 *  when the reading is ready. */
export const GET = proxyRoute("GET", "/v2/experiments/takes/:takeId/analysis", { noStore: true });
