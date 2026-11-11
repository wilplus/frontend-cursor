import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The kinds of set not ready yet, and whether the caller asked for each
 *  (backend N645 item 3): {coming: [{kind, title, wanted}]}. */
export const GET = proxyRoute("GET", "/v2/models/coming", { noStore: true });
