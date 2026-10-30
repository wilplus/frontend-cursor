import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Not here" and the Life Panel's switch (backend N268). */
export const GET = proxyRoute("GET", "/v2/walk-quote/setting", { noStore: true });
export const POST = proxyRoute("POST", "/v2/walk-quote/setting", { body: "json" });
