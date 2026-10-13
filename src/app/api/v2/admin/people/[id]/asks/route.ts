import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Send one ask to this person. The backend's @require_admin is the gate. */
export const POST = proxyRoute("POST", "/v2/admin/people/:id/asks", { body: "json", noStore: true });
