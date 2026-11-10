import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A teacher's earnings, in tokens (backend N531, N577, N583 item 4, MOD-47). */
export const GET = proxyRoute("GET", "/v2/models/earnings", { noStore: true });
