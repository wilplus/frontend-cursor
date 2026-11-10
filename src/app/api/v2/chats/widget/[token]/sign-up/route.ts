import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The sign-up after asking (backend N591 item 4; was "Keep this chat",
 *  N567 item 7), signed in, with the visitor's secret: {chat: {id}, notice_to,
 *  then the chat as the visitor reads it} or {waitlist: true}. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/sign-up", { body: "json", noStore: true, widgetGuest: "signed-in" });
