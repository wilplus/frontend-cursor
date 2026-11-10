import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** My bundles of questions, in Will's chat (backend N584 item 2): {bundles},
 *  the ones waiting first. 404 without the chat builder's ring. */
export const GET = proxyRoute("GET", "/v2/chats/bundles", { noStore: true });
