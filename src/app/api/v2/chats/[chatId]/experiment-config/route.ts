import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The host's voice-model choice on their chat recipe. A 403 stays a 403. */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/experiment-config", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/chats/:chatId/experiment-config", { body: "json", noStore: true });
