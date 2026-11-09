import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Use it in your business": the terms (backend N566 item 9, MOD-41, MOD-48). */
export const GET = proxyRoute("GET", "/v2/models/:modelId/use", { noStore: true });
