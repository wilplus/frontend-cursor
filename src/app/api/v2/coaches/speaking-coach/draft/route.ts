import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const PUT = proxyRoute("PUT", "/v2/coaches/speaking-coach/draft", { body: "json", noStore: true });
