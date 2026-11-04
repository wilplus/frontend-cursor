import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The joiner's tap on one of the link owner's questions (backend N487):
 *  {picked, date?}; {messages: their answer, then what follows}. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/setup/:messageId", { body: "json" });
