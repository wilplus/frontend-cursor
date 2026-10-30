import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Your why (backend N255): the three lines and their changes; POST keeps them. */
export const GET = proxyRoute("GET", "/v2/your-why", { noStore: true });
export const POST = proxyRoute("POST", "/v2/your-why", { body: "json" });
