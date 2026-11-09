import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A tap, or typed words, under Will's setup question (backend N582):
 *  {to, picked} or {to, said}; {messages}. 404 without the ring. */
export const POST = proxyRoute("POST", "/v2/chats/recipe/setup/answer", { body: "json", noStore: true });
