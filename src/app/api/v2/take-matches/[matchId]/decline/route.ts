import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Not now": the asking chat goes, and nobody is told (N485 item 3, N504). */
export const POST = proxyRoute("POST", "/v2/take-matches/:matchId/decline");
