import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/image/delete
 *
 * BFF passthrough for the Journal CMS cover generator: clear a candidate from
 * the strip. The stored file itself stays, so a post still pointing at that URL
 * does not break.
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/image/delete");
