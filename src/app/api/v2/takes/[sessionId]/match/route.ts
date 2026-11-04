import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** After a Take: one person who fits it, by pseudonym and role, or none (backend N477, #1712). */
export const GET = proxyRoute("GET", "/v2/takes/:sessionId/match", { noStore: true });
