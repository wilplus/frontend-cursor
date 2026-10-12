import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v2/voice-album/practice-answer
 *
 * BFF proxy — the owner's five-state answer on one of their own pending
 * clips. Body { arc_id, take_session_id, snippet_id, response } passed
 * through verbatim; the backend rejects anything outside the five states
 * rather than coercing it, so none of them is flattened in transit.
 *
 * The answer is owner routing on that exact recording — never a blind peer
 * label, never a coach judgment. Only a `yes` can help a moment into the
 * Voice Album, and only alongside the machine and coach legs.
 */
export const POST = proxyRoute("POST", "/v2/voice-album/practice-answer", { body: "text", noStore: true });
