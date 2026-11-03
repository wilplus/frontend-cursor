import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The other person's profile in a chat (backend N366), with the photos and
 *  files the two of you shared there. */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/profile", { noStore: true });
