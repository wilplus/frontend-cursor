import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/image/list
 *
 * BFF passthrough for the Journal CMS cover generator: every generated attempt
 * for a post, newest first. CMS-only — no public route reads these candidates.
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/image/list");
