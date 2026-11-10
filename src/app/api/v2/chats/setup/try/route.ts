import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Test my chat": {body} -> {messages, useful}; nothing is kept. */
export const POST = proxyRoute("POST", "/v2/chats/setup/try", { body: "json", noStore: true });
