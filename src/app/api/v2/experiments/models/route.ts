import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** GET /v2/experiments/models. A 404 stays a 404 so the screen can say
 *  the catalog is not on yet. */
export const GET = proxyRoute("GET", "/v2/experiments/models", { noStore: true });
