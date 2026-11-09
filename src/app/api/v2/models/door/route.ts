import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The disclaimer at the door before anyone teaches (backend N528 items 2
 *  and 10): {title, lines, actions}. 404 below ring 6. */
export const GET = proxyRoute("GET", "/v2/models/door", { noStore: true });
