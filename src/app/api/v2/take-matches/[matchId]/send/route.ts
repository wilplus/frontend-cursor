import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Send: the Take reaches the one suggested as an asking chat (N478 item 1, N485). */
export const POST = proxyRoute("POST", "/v2/take-matches/:matchId/send");
