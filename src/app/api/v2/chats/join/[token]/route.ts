import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A join link (backend N308, N328, N335). GET, before anyone signs in:
 *  {name}, whose link it is; 404 for a wrong or replaced link. POST, signed
 *  in: {chat: {id}}, the caller's chat with the link's owner, made once for
 *  the two; 401 signed out, 400 OWN_LINK for your own, 404 otherwise. */
export const GET = proxyRoute("GET", "/v2/chats/join/:token", { noStore: true });
export const POST = proxyRoute("POST", "/v2/chats/join/:token", { body: "json", noStore: true });
