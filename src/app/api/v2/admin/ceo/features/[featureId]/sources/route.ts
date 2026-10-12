import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const POST = proxyRoute("POST", "/v2/admin/ceo/features/:featureId/sources", { body: "text", noStore: true });
