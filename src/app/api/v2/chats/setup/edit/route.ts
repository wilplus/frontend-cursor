import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** What the host said to Will about changing their chat: {said} -> {line, parts}. */
export const POST = proxyRoute("POST", "/v2/chats/setup/edit", { body: "json", noStore: true });
