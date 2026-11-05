import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The visitor's chat (backend N565): GET reads it; POST {body} sends one
 *  of the three emoji. The visitor's secret travels in its header. */
export const GET = proxyRoute("GET", "/v2/chats/widget/:token/messages", { noStore: true, widgetGuest: "public" });
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/messages", { body: "json", noStore: true, widgetGuest: "public" });
