import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/posts/list
 *
 * BFF passthrough for the Journal CMS (every post including drafts, for the CMS list).
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/posts/list");
