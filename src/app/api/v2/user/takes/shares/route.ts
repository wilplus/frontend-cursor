import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The speaker's Takes shared right now, and where (Data & consent). */
export const GET = proxyRoute("GET", "/v2/user/takes/shares", { noStore: true });
