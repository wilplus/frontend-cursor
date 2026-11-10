import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Was this useful?" answered: {answer: yes|no|skip} -> {ok} (backend N616 item 6). */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/messages/:messageId/useful", { body: "json", noStore: true });
