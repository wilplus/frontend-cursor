import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/exercise-learning-evaluation
 *
 * BFF passthrough for the CMS jar page (founder 2026-09-29, evening: a full
 * jar unseals the evaluation by itself). Below the bar the backend answers
 * sealed, and why; at the bar it returns the scoreboard and the fair test in
 * two piles, machine picks alone and with the coach's picks. Nothing
 * promotes; a learned ranking still needs the founder's yes. Read-only.
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/exercise-learning-evaluation");
