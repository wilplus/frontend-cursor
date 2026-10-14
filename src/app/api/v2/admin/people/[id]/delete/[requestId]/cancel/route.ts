import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Cancel an account deletion inside its window. The backend's @require_admin is the gate. */
export const POST = proxyRoute("POST", "/v2/admin/people/:id/delete/:requestId/cancel", { noStore: true });
