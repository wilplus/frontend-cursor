import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayFile } from "../../../../chatUpload";

export const runtime = "nodejs";

/** A photo or a file in a chat with a person, opened (N351). */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/messages/:messageId/file", { relay: relayFile });
