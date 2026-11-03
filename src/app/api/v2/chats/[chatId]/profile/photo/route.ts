import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayFile } from "../../../chatUpload";

export const runtime = "nodejs";

/** The other person's photo in a chat (backend N366). */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/profile/photo", { relay: relayFile });
