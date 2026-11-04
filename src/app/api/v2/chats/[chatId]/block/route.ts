import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Block the other person in a chat (backend N466): they can't send you
 *  messages or answers, and aren't told. The backend answers {"blocked": true}. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/block", { body: "json" });

/** Unblock them: {"blocked": false}. */
export const DELETE = proxyRoute("DELETE", "/v2/chats/:chatId/block");
