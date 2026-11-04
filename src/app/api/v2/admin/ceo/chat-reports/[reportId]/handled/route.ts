import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Mark as read" on a report (backend N466): {"handled_at": <iso>}. */
export const POST = proxyRoute("POST", "/v2/admin/chat-reports/:reportId/handled", { body: "json", noStore: true });
