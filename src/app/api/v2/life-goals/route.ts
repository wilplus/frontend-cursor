import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Life goals (Will learning plan, step 3, backend N172): whether they are on, the goals and the open draft. */
export const GET = proxyRoute("GET", "/v2/life-goals", { noStore: true });
