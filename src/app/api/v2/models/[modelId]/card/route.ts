import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A ready model's card before a business uses it (backend N566 item 9,
 *  MOD-39); 404 below the ring or before its first version is released. */
export const GET = proxyRoute("GET", "/v2/models/:modelId/card", { noStore: true });
