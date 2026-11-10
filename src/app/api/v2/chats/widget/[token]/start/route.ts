import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The visitor's chat, made with their first message (backend N591, N595
 *  item 1: no card before it): {site, kind, body} → {guest, name, writes,
 *  messages, signed_up, sign_up, answered}, the host's welcome and questions
 *  first; the guest secret stays in the visitor's browser. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/start", { body: "json", noStore: true, widgetGuest: "public" });
