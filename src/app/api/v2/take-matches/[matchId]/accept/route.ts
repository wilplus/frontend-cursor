import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Open Take": accepting it shows the name and the Take; the asker is not told (N486 item 1). */
export const POST = proxyRoute("POST", "/v2/take-matches/:matchId/accept");
