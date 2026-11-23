import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/coach-wording", { noStore: true });
export const POST = proxyRoute("POST", "/v2/explore/arc/:arcId/coach-wording", { body: "json" });
