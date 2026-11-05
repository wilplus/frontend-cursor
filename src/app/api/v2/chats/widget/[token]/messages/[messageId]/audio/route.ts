import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** An answer's voice, for the widget's visitor (backend N565). */
export const GET = proxyRoute("GET", "/v2/chats/widget/:token/messages/:messageId/audio", {
  relay: relayAudio,
  range: true,
  widgetGuest: "public",
});
