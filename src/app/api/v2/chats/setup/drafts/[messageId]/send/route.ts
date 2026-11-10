import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One drafted answer sent: {body?} (the host's own words when changed) -> {message}. */
export const POST = proxyRoute("POST", "/v2/chats/setup/drafts/:messageId/send", { body: "json", noStore: true });
