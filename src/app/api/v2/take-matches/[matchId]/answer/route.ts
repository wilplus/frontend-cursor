import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The answer, a Take over the Take's own slides, held for its five seconds (N481, N493). */
export const POST = proxyRoute("POST", "/v2/take-matches/:matchId/answer");
