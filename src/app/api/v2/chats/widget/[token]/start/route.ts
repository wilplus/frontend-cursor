import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Agree and start" (backend N566): the visitor's chat, made now. {guest,
 *  name, asks, messages, kept}; the guest secret stays in the visitor's
 *  browser. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/start", { body: "json", noStore: true, widgetGuest: "public" });
