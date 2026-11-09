import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Not now": the invite stays and opens whenever they like (MOD-49). */
export const POST = proxyRoute("POST", "/v2/models/invites/:inviteId/not-now", { body: "json", noStore: true });
