import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Set or end one person's plan promotion. The backend's @require_admin is the gate. */
export const PUT = proxyRoute("PUT", "/v2/admin/people/:id/promotion", { body: "json", noStore: true });
export const DELETE = proxyRoute("DELETE", "/v2/admin/people/:id/promotion", { noStore: true });
