import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The speaker's remembered sharing choice, and whether to ask again (backend N309 item 5). */
export const GET = proxyRoute("GET", "/v2/user/takes/share/last", { noStore: true });
