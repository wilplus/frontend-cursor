import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* GET /api/v2/admin/people/<id> — one person's profile. Carries no secret;
 * the backend's @require_admin is the gate. */
export const GET = proxyRoute("GET", "/v2/admin/people/:id", { noStore: true });
