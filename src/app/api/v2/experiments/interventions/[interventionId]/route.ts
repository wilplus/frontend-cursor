import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** PUT and DELETE /v2/experiments/interventions/<id>. */
export const PUT = proxyRoute("PUT", "/v2/experiments/interventions/:interventionId", { body: "json", noStore: true });
export const DELETE = proxyRoute("DELETE", "/v2/experiments/interventions/:interventionId", { noStore: true });
