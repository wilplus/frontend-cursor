import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The lens: the suggestion and the notes it came from (backend N241 N2). */
export const GET = proxyRoute("GET", "/v2/strengths/:strengthId", { noStore: true });
