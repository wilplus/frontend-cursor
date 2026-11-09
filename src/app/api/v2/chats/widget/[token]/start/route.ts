import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Agree and start" (backend N567, N591): the visitor's chat, made now,
 *  with the host's welcome and questions. {guest, name, writes, messages,
 *  signed_up, sign_up, answered}; the guest secret stays in the visitor's
 *  browser. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/start", { body: "json", noStore: true, widgetGuest: "public" });
