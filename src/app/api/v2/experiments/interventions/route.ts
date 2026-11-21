import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** GET and POST /v2/experiments/interventions. */
export const GET = proxyRoute("GET", "/v2/experiments/interventions", { noStore: true });
export const POST = proxyRoute("POST", "/v2/experiments/interventions", { body: "json", noStore: true });
