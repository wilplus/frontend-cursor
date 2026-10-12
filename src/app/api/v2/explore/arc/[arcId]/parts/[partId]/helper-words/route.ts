import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/parts/[partId]/helper-words
 *
 * BFF proxy — helper words taken from any earlier Take (founder lock
 * 2026-09-30, B4, D5). Body {phrase, take_index} relays verbatim; the
 * backend checks the words are exact words of that Take's version and
 * stores them on the Slide. The lock that follows goes through /lock.
 */
export const PUT = proxyRoute("PUT", "/v2/explore/arc/:arcId/parts/:partId/helper-words", { body: "json" });
