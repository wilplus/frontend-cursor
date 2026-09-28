import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/exercise-gaps
 *
 * BFF passthrough for the CMS gap view (backend 2026-09-28, step 5): which
 * patterns most need an exercise filmed. Read-only.
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/exercise-gaps");
