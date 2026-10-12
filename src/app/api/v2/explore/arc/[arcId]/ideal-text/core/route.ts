import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/ideal-text/core", { guest: true });

