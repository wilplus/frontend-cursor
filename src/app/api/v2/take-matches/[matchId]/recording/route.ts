import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The matched Take's voice, after Open Take only (N485 item 2). */
export const GET = proxyRoute("GET", "/v2/take-matches/:matchId/recording", { relay: relayAudio, range: true });
