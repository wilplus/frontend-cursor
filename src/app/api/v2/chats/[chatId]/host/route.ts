import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** For someone in a host's chat (backend N578, N586 item 1, N590): whose
 *  assistant answers, who the host is, their questions and how people
 *  answer; {host: null} for a chat that is as it was. */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/host", { noStore: true });
