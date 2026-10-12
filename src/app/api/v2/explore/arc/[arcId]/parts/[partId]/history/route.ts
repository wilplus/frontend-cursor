import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The history behind a Paragraph's bookmark (contract 16). Owner only. */
export const GET = proxyRoute("GET", "/v2/explore/arc/:arcId/parts/:partId/history", { guest: true });
