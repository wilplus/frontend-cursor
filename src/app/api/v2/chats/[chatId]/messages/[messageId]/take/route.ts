import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A Take sent in a chat, for its member to open: the recording and its words, slide by slide (backend N470, N472). */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/messages/:messageId/take", { noStore: true });
