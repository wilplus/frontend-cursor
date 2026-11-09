import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The setup of my chat in Will's chat, its first question or its open one
 *  again (backend N582 item 1): {started}. 404 without the ring. */
export const POST = proxyRoute("POST", "/v2/chats/recipe/setup", { body: "json", noStore: true });
