import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The One thing walk's "Last time" for one Take (backend N309 item 1): the
 *  previous Take's fix when it rose, with this Take's clip on that slide. */
export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/review/last-fix/:takeId", { noStore: true });
