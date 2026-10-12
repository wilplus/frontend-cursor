import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const GET = proxyRoute("GET", "/v2/admin/ceo/bootstrap", { noStore: true });
