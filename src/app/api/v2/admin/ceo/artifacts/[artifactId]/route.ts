import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const PATCH = proxyRoute("PATCH", "/v2/admin/ceo/artifacts/:artifactId", { body: "text", noStore: true });
