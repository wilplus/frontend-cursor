import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The voice notebook's state for the signed-in person (Will learning plan, step 1). */
export const GET = proxyRoute("GET", "/v2/notebook/state", { noStore: true });
