import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "I want this" for a part the chat cannot run yet: the feedback walk
 *  (backend N641 item 3): one mail to the founder, not counted -> {wanted}. */
export const POST = proxyRoute("POST", "/v2/chats/setup/:part/want", { body: "json", noStore: true });
