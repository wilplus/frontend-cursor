import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A model's page for the caller (backend N526 items 2 and 3): totals for
 *  the public, more for its teachers and owner; 404 when they may not see it. */
export const GET = proxyRoute("GET", "/v2/models/:modelId", { noStore: true });
