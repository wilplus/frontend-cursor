import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Will says what what you know is worth, with "Set up my chat" (backend
 *  N586 item 5): {offered}. 404 without the ring. */
export const POST = proxyRoute("POST", "/v2/chats/recipe/setup/offer", { body: "json", noStore: true });
