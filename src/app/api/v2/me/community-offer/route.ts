import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The newcomer's one offer to join the community of the business whose
 *  link they came by, while Take 1 is processed (backend N559 item 1):
 *  GET {offer: {id, name, inviter} | null}; POST {id, answer: "join" |
 *  "not_now"} → {offer: null, joined}. */
export const GET = proxyRoute("GET", "/v2/me/community-offer", { noStore: true });
export const POST = proxyRoute("POST", "/v2/me/community-offer");
