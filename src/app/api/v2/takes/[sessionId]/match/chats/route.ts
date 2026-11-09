import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Who hears this Take: your own chats, best fit first, {order: [chat id…]};
 *  only the order, never a score (backend N559 item 2, #1861). */
export const GET = proxyRoute("GET", "/v2/takes/:sessionId/match/chats", { noStore: true });
