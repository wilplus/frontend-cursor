import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The answers to my Take, gathered under it, for me only (backend N587
 *  items 3 to 5): {bubble: {shown, faces}, groups: [{title, answers}]}.
 *  404 without the chat builder's ring, or for a Take sent nowhere. */
export const GET = proxyRoute("GET", "/v2/user/takes/:takeSessionId/answers", { noStore: true });
