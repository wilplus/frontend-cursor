import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The visitor's question, one of the three (backend N567 item 5): {i} →
 *  {message}; 409 while the last one waits for its answer. */
export const POST = proxyRoute("POST", "/v2/chats/widget/:token/ask", { body: "json", noStore: true, widgetGuest: "public" });
