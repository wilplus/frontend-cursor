import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Your chat on any website (backend N565): the widget's first read, no
 *  sign-in. {name, asks}; 404 for a wrong, replaced or switched-off link. */
export const GET = proxyRoute("GET", "/v2/chats/widget/:token", { noStore: true, widgetGuest: "public" });
