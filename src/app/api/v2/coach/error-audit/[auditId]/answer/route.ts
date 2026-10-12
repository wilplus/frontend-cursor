import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 6a: one blind answer (yes, no, cant_tell), once.
export const POST = proxyRoute("POST", "/v2/coach/error-audit/:auditId/answer", { body: "json" });
