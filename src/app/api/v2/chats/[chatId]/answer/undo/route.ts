import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Undo (backend N345 item 2, N441): {message, project}; the backend takes
 *  a held answer back and answers {"undone": true}, or 409 once it has gone. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/answer/undo", { body: "json" });
