import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A Take recorded in a host's chat that takes Takes (backend N648 item 8,
 *  #1961): {take}, the caller's own Take, already uploaded through the one
 *  loop, tagged with the chat it was made in, once; 404 where the door is
 *  shut. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/take", { body: "json" });
