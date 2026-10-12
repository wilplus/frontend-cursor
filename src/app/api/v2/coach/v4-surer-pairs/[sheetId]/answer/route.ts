import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// V4 B1.9: one answer (yes, no or can't tell), once.
export const POST = proxyRoute("POST", "/v2/coach/v4-surer-pairs/:sheetId/answer", { body: "json" });
