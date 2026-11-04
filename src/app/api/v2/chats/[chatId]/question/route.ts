import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A question recorded with "Record your question", sent once its Take is up
 *  (backend N483 item 4, N498): the answer's body, {take, duration_ms,
 *  hold_ms}; the backend holds it the same way and marks it for the other
 *  person to answer. Its Undo is the answer's (`answer/undo`). */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/question", { body: "json" });
