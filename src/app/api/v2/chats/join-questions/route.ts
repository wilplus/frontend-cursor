import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The questions I set for whoever joins through my link (backend N487):
 *  {questions} or {questions: null}. PUT replaces them. */
export const GET = proxyRoute("GET", "/v2/chats/join-questions", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/chats/join-questions", { body: "json", noStore: true });
