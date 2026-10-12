import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// V4 B1.8 (founder S-B8 A): "Pick the moment for feedback", this rater's
// pending blocks, words and audio only. Dark (404) until V4_COACH_SHEETS_ENABLED.
export const GET = proxyRoute("GET", "/v2/coach/v4-moment-picks");
