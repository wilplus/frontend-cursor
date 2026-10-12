import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = proxyRoute("POST", "/v2/user/snippets/:snippetId/confidence-practice", { body: "json" });
