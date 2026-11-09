import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The invite accepted: the caller teaches the model (MOD-49). */
export const POST = proxyRoute("POST", "/v2/models/invites/:inviteId/accept", { body: "json", noStore: true });
