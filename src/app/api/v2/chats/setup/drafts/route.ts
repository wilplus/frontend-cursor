import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The answers Will drafted for the host to send (backend N618 item 9,
 *  N629 item 3): {drafts}. Ring chat_builder; 404 without it. */
export const GET = proxyRoute("GET", "/v2/chats/setup/drafts", { noStore: true });
