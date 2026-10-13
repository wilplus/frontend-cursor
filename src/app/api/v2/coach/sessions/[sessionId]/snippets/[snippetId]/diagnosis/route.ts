import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// The diagnosis first (coach panel lock flow 6; D-CP-4): the errors in the
// lock's order and this coach's current diagnosis; PUT one diagnosis. The
// backend keeps it behind the coach's own blind rating (BLIND COACH).
const PATH = "/v2/coach/sessions/:sessionId/snippets/:snippetId/diagnosis";
export const GET = proxyRoute("GET", PATH);
export const PUT = proxyRoute("PUT", PATH, { body: "json" });
