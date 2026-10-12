import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 1b (founder 2026-10-01, F8): the exercise the machine served on a
// moment and the pool it could swap to; the coach's explicit keep, swap or
// new. Dark on the backend (404) until COACH_EXERCISE_PREFERENCE_ENABLED.
const PATH = "/v2/coach/sessions/:sessionId/snippets/:snippetId/exercise-preference";
export const GET = proxyRoute("GET", PATH);
export const POST = proxyRoute("POST", PATH, { body: "json" });
