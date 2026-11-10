import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The visitor's chat (backend N567, N591): GET reads it (the host's answers
 *  wait behind the sign-up); POST {kind: "emoji" | "text", body} sends one of
 *  the three emoji, or typed words where the host's setup allows typing. The
 *  visitor's secret travels in its header. */
export const GET = proxyRoute("GET", "/v2/chats/widget/:token/messages", { noStore: true, widgetGuest: "public" });
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/messages", { body: "json", noStore: true, widgetGuest: "public" });
