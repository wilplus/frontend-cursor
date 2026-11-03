/* An older Take's Ideal Text card (founder 2026-11-03, backend N375): which
   version it opens, read before the page is drawn, and its paragraphs slide
   by slide. The page itself is IdealTextPastVersion. */
import { PAST_TAKE_COPY } from "@/components/willab/idealEditCopy";
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

/** The row a card names: its document version, or the Take a review's
 *  own card names. Newest first as served: a Take with two versions names
 *  its newest. */
function cardRevision(
  revisions: readonly IdealTextRevision[],
  past: IdealTextPast,
): IdealTextRevision | undefined {
  return revisions.find((r) => (past.by === "version" ? r.revision === past.n : r.takeIndex === past.n));
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

/** What a card opens: its older version (with the latest Take, for "Go to
 *  Take M"), or the live page, with the line that says so when the card's
 *  version was not kept (N380). */
export type PastOpen =
  | { kind: "past"; revision: IdealTextRevision; latestTake: number | null }
  | { kind: "live"; notice: string | null };

export async function resolvePastIdealText(
  arcId: string,
  past: IdealTextPast,
): Promise<PastOpen> {
  warmPastIdealText(arcId);
  const read = warmed.get(arcId)!.read;
  // Used once: the next open reads afresh (a new Take may have landed).
  warmed.delete(arcId);
  const rv = await read;
  if (rv.kind !== "ready") return { kind: "live", notice: null };
  const latestTake = rv.revisions.find((r) => r.isHead)?.takeIndex ?? null;
  const hit = cardRevision(rv.revisions, past);
  // The newest: the page, as it is.
  if (hit?.isHead) return { kind: "live", notice: null };
  if (hit?.text.trim()) return { kind: "past", revision: hit, latestTake };
  // Not kept: the page, saying so.
  const notice = latestTake !== null && latestTake !== past.n ? PAST_TAKE_COPY.notSaved(past.n, latestTake) : null;
  return { kind: "live", notice };
}

/** The helper words a slide had while the version was the latest, joined
 *  as the page joins a headline (" · "). */
export function helperHeadlineOf(revision: Pick<IdealTextRevision, "helperWords">, slideIndex: number | null): string | null {
  if (slideIndex === null) return null;
  const hit = revision.helperWords.find((h) => h.slideIndex === slideIndex);
  return hit ? hit.phrases.join(" · ") : null;
}

/** The version's paragraphs, slide by slide as the live page groups them:
 *  consecutive paragraphs on one slide share its picture and kicker. An
 *  unproved slide map shows the words alone, as one group. */
export function slideGroupsOf(
  revision: Pick<IdealTextRevision, "text" | "slides">,
): { slideIndex: number | null; paragraphs: string[] }[] {
  const paragraphs = revision.text.split("\n\n");
  const slides = revision.slides?.length === paragraphs.length ? revision.slides : null;
  if (!slides) return [{ slideIndex: null, paragraphs }];
  const groups: { slideIndex: number | null; paragraphs: string[] }[] = [];
  paragraphs.forEach((paragraph, i) => {
    const last = groups[groups.length - 1];
    if (last && last.slideIndex === slides[i]) last.paragraphs.push(paragraph);
    else groups.push({ slideIndex: slides[i], paragraphs: [paragraph] });
  });
  return groups;
}
