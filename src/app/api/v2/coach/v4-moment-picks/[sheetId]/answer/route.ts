import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// V4 B1.8: one answer (a moment, or none needs it), once.
export const POST = proxyRoute("POST", "/v2/coach/v4-moment-picks/:sheetId/answer", { body: "json" });
