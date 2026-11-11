import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "I want this" for the feedback walk (backend N641 item 3): one mail to
 *  the founder, not counted -> {wanted}. */
export const POST = proxyRoute("POST", "/v2/chats/setup/walk/want", { body: "json", noStore: true });
