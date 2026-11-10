import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The blank setup begun from what the host does: {what} -> {recipe}, every part Will's first suggestion. */
export const POST = proxyRoute("POST", "/v2/chats/setup/start", { body: "json", noStore: true });
