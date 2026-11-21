import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** POST /v2/experiments/analyze-take. 202 {take_id, status, model_id}
 *  passes through. */
export const POST = proxyRoute("POST", "/v2/experiments/analyze-take", { body: "json", noStore: true });
