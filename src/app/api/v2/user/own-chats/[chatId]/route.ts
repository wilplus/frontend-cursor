import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* Rename one of a person's own chats (backend N700). */

export const PATCH = proxyRoute("PATCH", "/v2/user/own-chats/:chatId", { body: "json", noStore: true });
