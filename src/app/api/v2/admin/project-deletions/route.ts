import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Operator queue of open project deletion requests (P1, N8). The backend's
 * admin decorator is the authorization boundary; this BFF only forwards. */
export const GET = proxyRoute("GET", "/v2/admin/project-deletions", { noStore: true });
