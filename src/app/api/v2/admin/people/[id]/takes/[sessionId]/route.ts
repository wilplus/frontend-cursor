import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* One Take's pieces with every measure. The backend's @require_admin is the gate. */
export const GET = proxyRoute("GET", "/v2/admin/people/:id/takes/:sessionId", { noStore: true });
