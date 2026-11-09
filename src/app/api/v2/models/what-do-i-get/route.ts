import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "What do I get?", three short cards (backend N566 item 11): {title,
 *  cards, back}. 404 below ring 6. */
export const GET = proxyRoute("GET", "/v2/models/what-do-i-get", { noStore: true });
