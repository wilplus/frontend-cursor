import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* One person's exercises, as facts (founder 2026-10-18, WIL-29). Carries no
 * secret; the backend's @require_founder is the gate, so any other admin
 * gets 403 and the person page leaves the section out. */
export const GET = proxyRoute("GET", "/v2/admin/people/:id/practice-effects", { noStore: true });
