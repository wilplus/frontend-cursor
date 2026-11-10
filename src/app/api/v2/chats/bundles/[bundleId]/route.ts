import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "See who asked ›" (backend N602 item 2): the sheet "Who asked", each
 *  person's own words and name, then "Split them up". 404 without the chat
 *  builder's ring, or on a backend without the route. */
export const GET = proxyRoute("GET", "/v2/chats/bundles/:bundleId", { noStore: true });
