import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One asking chat: the outside only before Open Take; after it, the name and the Take (N485). */
export const GET = proxyRoute("GET", "/v2/take-matches/:matchId", { noStore: true });
