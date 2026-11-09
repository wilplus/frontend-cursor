import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** An invite to teach, as it stays in the chat (backend N528 item 3):
 *  {lines, action}. 404 for anyone but the person invited, and below ring 6. */
export const GET = proxyRoute("GET", "/v2/models/invites/:inviteId", { noStore: true });
