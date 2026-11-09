import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Keep this chat" (backend N567 item 7), signed in, with the visitor's
 *  secret: {chat: {id}} or {waitlist: true}. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/keep", { body: "json", noStore: true, widgetGuest: "signed-in" });
