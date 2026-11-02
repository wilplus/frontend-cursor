import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The list of chats (backend N298, N302; ring 6, feature `chats`): each
 *  chat with its title, subtitle and last message. 404 when the ring is off. */
export const GET = proxyRoute("GET", "/v2/chats", { noStore: true });
