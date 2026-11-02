import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** A voice message in a chat with a person, played back (N321 item 2). */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/messages/:messageId/audio", { relay: relayAudio, range: true });
