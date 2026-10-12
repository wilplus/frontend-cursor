import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const PUT = proxyRoute("PUT", "/v2/explore/arc/:arcId/parts/:partId/root", { body: "json" });
