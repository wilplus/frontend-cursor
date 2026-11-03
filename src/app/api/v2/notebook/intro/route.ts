import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Lounge opened: the notebook's introduction, opened by a strength
 *  Will spots in the last Takes, when it is due (backend N411 items 1, 5). */
export const POST = proxyRoute("POST", "/v2/notebook/intro", { body: "json", noStore: true });
