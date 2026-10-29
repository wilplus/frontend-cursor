import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Strengths (backend N241 N1, N5): kept and archived, with their notes. */
export const GET = proxyRoute("GET", "/v2/strengths", { noStore: true });
