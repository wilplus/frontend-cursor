import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const POST = proxyRoute("POST", "/v2/admin/ceo/projects/:projectKey/features", { body: "text", noStore: true });
