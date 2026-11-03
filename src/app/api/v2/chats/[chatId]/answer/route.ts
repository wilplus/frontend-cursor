import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** An answer recorded with "Record an answer", sent once its Take is up
 *  (backend N363, N441): {take, duration_ms, hold_ms}; the backend holds it
 *  for what is left of its 5 seconds and answers the message. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/answer", { body: "json" });
