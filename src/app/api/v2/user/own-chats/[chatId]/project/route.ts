import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* A chat's first Take or slides give it its project (backend N700). */

export const POST = proxyRoute("POST", "/v2/user/own-chats/:chatId/project", { body: "json", noStore: true });
