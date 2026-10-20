import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Will's private note on one speaker (WIL-74, founder 2026-10-20). The
 * backend's @require_founder is the gate: any other admin gets 403 and the
 * person page leaves the section out. */
export const GET = proxyRoute("GET", "/v2/admin/people/:id/speaker-memory", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/admin/people/:id/speaker-memory", { body: "json", noStore: true });
