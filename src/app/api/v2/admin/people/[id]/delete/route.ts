import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Delete this person's account (seven-day window). The backend's @require_admin is the gate. */
export const POST = proxyRoute("POST", "/v2/admin/people/:id/delete", { noStore: true });
