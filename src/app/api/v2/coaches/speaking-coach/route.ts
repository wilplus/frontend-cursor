import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The founder's speaking-coach draft. 404 until the backend has the route. */
export const GET = proxyRoute("GET", "/v2/coaches/speaking-coach", { noStore: true });
