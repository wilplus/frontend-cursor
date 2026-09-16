import { internalJournalPassthrough } from "@/app/api/v2/internal/journal/_shared";

/**
 * POST /api/v2/internal/journal/image/select
 *
 * BFF passthrough for the Journal CMS cover generator: promote an earlier
 * attempt onto the post's cover. This is the undo for Regenerate, and the
 * retry path when a draw stored its image but failed to attach it.
 *
 * (see _shared.ts for the password-gating and error-relay behavior common
 * to every internal tool.)
 */
export const runtime = "nodejs";
export const POST = internalJournalPassthrough("/v2/internal/journal/image/select");
