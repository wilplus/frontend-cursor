import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The first time "Add someone to chat with" opens (backend N503): Will
 *  asks the setup in his chat. {started}. */
export const POST = proxyRoute("POST", "/v2/chats/join-questions/setup", { body: "json", noStore: true });
