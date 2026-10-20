import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Will's questions after a Take, as the founder edits them on the coach
 * panel (N83, founder 2026-10-20). The backend's @require_founder is the
 * gate: anyone else gets 403 and the queue leaves the row out. */
export const GET = proxyRoute("GET", "/v2/admin/will-questions", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/admin/will-questions", { body: "json", noStore: true });
