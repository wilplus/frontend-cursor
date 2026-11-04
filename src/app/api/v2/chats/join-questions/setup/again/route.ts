import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Your questions for people who join ›": the summary again (backend N503). */
export const POST = proxyRoute("POST", "/v2/chats/join-questions/setup/again", { body: "json", noStore: true });
