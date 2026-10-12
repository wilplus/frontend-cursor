import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// V4 B1.9 (founder S-B8 A): "Which sounds surer", this rater's pending pairs,
// words only. Dark (404) until V4_COACH_SHEETS_ENABLED.
export const GET = proxyRoute("GET", "/v2/coach/v4-surer-pairs");
