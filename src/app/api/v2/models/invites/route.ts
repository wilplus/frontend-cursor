import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The caller's invites to teach, open or put off (backend N528 item 3,
 *  MOD-49): {invites: [{id, model_id, lines, action}]}. 404 below ring 6. */
export const GET = proxyRoute("GET", "/v2/models/invites", { noStore: true });
