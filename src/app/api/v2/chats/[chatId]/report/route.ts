import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Report the other person (backend N466): {"block": true|false}; the chat's
 *  last five messages go to WillpowerLab. The backend answers
 *  {"reported": true, "blocked": <bool>}. */
export const POST = proxyRoute("POST", "/v2/chats/:chatId/report", { body: "json" });
