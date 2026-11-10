import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** An answer's voice, for the widget's visitor once signed up (backend N567,
 *  N591 item 4). */
export const GET = proxyRoute("GET", "/v2/chats/widget/:token/messages/:messageId/audio", {
  relay: relayAudio,
  range: true,
  widgetGuest: "public",
});
