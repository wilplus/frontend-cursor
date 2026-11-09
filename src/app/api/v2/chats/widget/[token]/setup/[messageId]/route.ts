import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The visitor's tap on one of the owner's join questions (backend N567,
 *  N487): {picked, date?} → {messages}. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/setup/:messageId", { body: "json", noStore: true, widgetGuest: "public" });
