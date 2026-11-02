import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The caller's own join link (backend N308; ring 6, feature `chats`):
 *  {token, path}, made the first time. POST replaces it, so the old one
 *  stops working. 404 when the ring is off. */
export const GET = proxyRoute("GET", "/v2/chats/link", { noStore: true });
export const POST = proxyRoute("POST", "/v2/chats/link", { body: "json", noStore: true });
