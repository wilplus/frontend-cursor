import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Not now, from the speaker: the suggestion closes, nothing is sent (N476 item 3). */
export const POST = proxyRoute("POST", "/v2/take-matches/:matchId/close");
