import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/exercise-learning-readiness
 *
 * BFF passthrough for the CMS jar page (founder 2026-09-29, decision 5): how
 * close the exercise learning data is to its evidence bar, 300 first-exposure
 * attempts with a valid endpoint and 30 per exercise. Counts only; the
 * backend never computes an outcome here. Read-only.
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/exercise-learning-readiness");
