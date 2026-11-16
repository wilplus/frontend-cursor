import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const POST = proxyRoute("POST", "/v2/coaches/speaking-coach/plugins", { body: "json", noStore: true });
