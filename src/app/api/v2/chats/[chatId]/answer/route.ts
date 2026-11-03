import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** An answer recorded with "Record an answer", sent once its Undo has passed
 *  (backend N363): {take, duration_ms}; the backend answers the message. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/answer", { body: "json" });
