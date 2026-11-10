import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A host's blank setup (backend N616, N618; ring chat_builder, 404 without it): {recipe|null, parts, own_chat, cost}. */
export const GET = proxyRoute("GET", "/v2/chats/setup", { noStore: true });
