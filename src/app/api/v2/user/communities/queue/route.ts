import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Other speakers' moments to judge: the listener's communities first, then
 *  the general one, then training clips. Audio only. */
export const GET = proxyRoute("GET", "/v2/user/communities/queue");
