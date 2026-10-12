import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 6a (founder 2026-10-01, F6): this coach's pending blind error checks.
// Dark (404) until ERROR_PRESENCE_AUDIT_ENABLED.
export const GET = proxyRoute("GET", "/v2/coach/error-audit");
