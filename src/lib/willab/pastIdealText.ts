/* An older Take's Ideal Text card (founder 2026-11-03, backend N375): which
   version it opens, read before the page is drawn, and its paragraphs slide
   by slide. The page itself is IdealTextPastVersion. */
import {
  fetchIdealTextRevisions,
  type IdealTextRevision,
  type RevisionsResult,
} from "@/services/api/blockVariants";

/** Which version a card names: the document's version ("ideal_text" cards)
 *  or the Take a review's own card names (its "N.0" is the Take). */
export type IdealTextPast = {
  by: "version" | "take";
  n: number;
  /** The project's name, from the card. */
  title?: string | null;
};

/** The older version a card opens, or null when the card's version is the
 *  newest or has no saved words: then the live page opens, as before. */
export function pastRevisionOf(
  revisions: readonly IdealTextRevision[],
  past: IdealTextPast,
): IdealTextRevision | null {
  // Newest first as served: a Take with two versions opens its newest.
  const hit = revisions.find((r) =>
    past.by === "version" ? r.revision === past.n : r.takeIndex === past.n,
  );
  if (!hit || hit.isHead || !hit.text.trim()) return null;
  return hit;
}

/* ONE SCREEN PER TAP. The choice between this page and the live one is made
   before either is drawn, so a card never shows a loader and then swaps to
   the other page. A press on an older card starts the read (as a press on
   the newest starts the live page's), and the tap reuses it. */
const WARM_MS = 30_000;
const warmed = new Map<string, { at: number; read: Promise<RevisionsResult> }>();

/** Start reading the project's versions, on a press of an older card. */
export function warmPastIdealText(arcId: string | null): void {
  if (!arcId) return;
  // The page's own code too, so the tap finds it loaded.
  void import("@/components/willab/IdealTextPastVersion");
  const kept = warmed.get(arcId);
  if (kept && Date.now() - kept.at < WARM_MS) return;
  warmed.set(arcId, { at: Date.now(), read: fetchIdealTextRevisions(arcId) });
}

/** The older version the card opens, or null for the live page. */
export async function resolvePastIdealText(
  arcId: string,
  past: IdealTextPast,
): Promise<IdealTextRevision | null> {
  warmPastIdealText(arcId);
  const read = warmed.get(arcId)!.read;
  // Used once: the next open reads afresh (a new Take may have landed).
  warmed.delete(arcId);
  const rv = await read;
  return rv.kind === "ready" ? pastRevisionOf(rv.revisions, past) : null;
}

/** The version's paragraphs, slide by slide as the live page groups them:
 *  consecutive paragraphs on one slide share its picture and kicker. An
 *  unproved slide map shows the words alone, as one group. */
export function slideGroupsOf(
  revision: Pick<IdealTextRevision, "text" | "slides">,
): { slideIndex: number | null; text: string }[] {
  const paragraphs = revision.text.split("\n\n");
  const slides = revision.slides?.length === paragraphs.length ? revision.slides : null;
  if (!slides) return [{ slideIndex: null, text: revision.text }];
  const groups: { slideIndex: number | null; paragraphs: string[] }[] = [];
  paragraphs.forEach((paragraph, i) => {
    const last = groups[groups.length - 1];
    if (last && last.slideIndex === slides[i]) last.paragraphs.push(paragraph);
    else groups.push({ slideIndex: slides[i], paragraphs: [paragraph] });
  });
  return groups.map((g) => ({ slideIndex: g.slideIndex, text: g.paragraphs.join("\n\n") }));
}
