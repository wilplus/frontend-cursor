import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A tap, or one's own words, under Will's setup question (backend N487):
 *  {to, picked} or {to, said}; {messages}. */
export const POST = proxyRoute("POST", "/v2/chats/join-questions/setup/answer", { body: "json", noStore: true });
