import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Hide this person from the Users list, or show them again (N221). Only the
 * list changes; the account is untouched. The backend's @require_admin is the gate. */
export const PUT = proxyRoute("PUT", "/v2/admin/people/:id/hidden", { noStore: true });
export const DELETE = proxyRoute("DELETE", "/v2/admin/people/:id/hidden", { noStore: true });
