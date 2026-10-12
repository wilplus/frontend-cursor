import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 8: one pick (a clip, or can't tell), once.
export const POST = proxyRoute("POST", "/v2/coach/block-picks/:pickId/answer", { body: "json" });
