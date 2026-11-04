import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* One person's "Not now"s, behavioural data (backend N504 item 2). The
 * backend's @require_founder is the gate: any other admin gets 403 and the
 * person page leaves the section out. */
export const GET = proxyRoute("GET", "/v2/admin/people/:id/not-now", { noStore: true });
