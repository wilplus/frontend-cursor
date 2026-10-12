import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const PUT = proxyRoute("PUT", "/v2/user/confidence-practice/:practiceId/helper-words", { body: "json" });
