import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Not now" under what someone asked me (backend N483 item 3, N493 item 3): nobody is told; the system keeps it (N504 item 2). */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/messages/:messageId/not-now");
