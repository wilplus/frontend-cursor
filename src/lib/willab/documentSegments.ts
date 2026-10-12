import { splitBadgeParagraphSpans } from "./pieceBadges";

/* -------------------------------------------------------------------------- */
/*  documentSegments — the PRESENTATIONAL segmentation of the ideal text       */
/*  (T1 · 1.2).                                                               */
/*                                                                            */
/*  The backend stores ONE plain-text document. Segments exist only so the     */
/*  student can point at a part of it — tap a gap to add, drag a part to move  */
/*  it. After every action the WHOLE joined document is what gets saved, never */
/*  a delta.                                                                  */
/*                                                                            */
/*  Granularity is the PARAGRAPH, deliberately, for three reasons:            */
/*   1. "\n\n" is the boundary the BE joins on, so split→join round-trips      */
/*      exactly and an untouched document never looks edited.                  */
/*   2. It is the same boundary the piece badges zip against                   */
/*      (splitBadgeParagraphSpans), so segments and version pills can never    */
/*      disagree about where a part starts.                                    */
/*   3. It is marker-safe: a rich-marker token containing a blank line is      */
/*      never sliced through, so dragging can't leak raw marker syntax.        */
/*                                                                            */
/*  Everything here is pure — the drag/tap UI lives in DocumentArranger.       */
/* -------------------------------------------------------------------------- */

/** The document's parts, in order. Blank parts are dropped: an empty segment
 *  has no words to move and would render as a dead drop target. */
export function splitSegments(text: string): string[] {
  return splitBadgeParagraphSpans(text)
    .map((p) => p.text.trim())
    .filter((t) => t.length > 0);
}

/** The parts back into the document the PUT sends. Mirrors the BE's join. */
export function joinSegments(segments: string[]): string {
  return segments
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/** The BE's hard ceiling on the stored document (400 INVALID_INPUT past it).
 *  Checked client-side too so a doomed PUT never leaves the browser and the
 *  student's words stay on screen either way. */
export const MAX_DOCUMENT_CHARS = 20000;
