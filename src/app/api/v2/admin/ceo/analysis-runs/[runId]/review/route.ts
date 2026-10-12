import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const POST = proxyRoute("POST", "/v2/admin/ceo/analysis-runs/:runId/review", { body: "text", noStore: true });
