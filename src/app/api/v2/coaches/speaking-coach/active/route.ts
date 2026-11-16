import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The document published to this account. Absent: the hardcoded walk. */
export const GET = proxyRoute("GET", "/v2/coaches/speaking-coach/active", { noStore: true });
