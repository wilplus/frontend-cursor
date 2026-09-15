/** The chunk sheet as an ordered ladder — one decision per screen.
 *
 *  Founder 2026-09-15. The sheet used to be three faces ("review" | "editor" |
 *  "root") with the review face iterating an inventory in place, and the
 *  emphasis offer riding inside the editor sharing a footer with Lock. Two
 *  decisions in one footer, and an order inherited from whatever the payload
 *  happened to list first.
 *
 *  Now it is one list, built when the modal opens and walked one screen at a
 *  time. A PURE module for the reason displayKind.ts gives next door: the
 *  ordering rule is a product decision, and vitest cannot transform .tsx
 *  imports here, so a rule left inside the modal is a rule no unit test can
 *  reach.
 *
 *  ORDER IS ENFORCED, NOT INHERITED. Confidence is always asked first: it is
 *  the one judgement about the speaker's own delivery, and asking it after a
 *  rewrite proposal would have them judge a recording they have just been told
 *  to change. Then the remaining feedback in server order, then the emphasis
 *  offer, then always the lock.
 */
import type { DocumentSuggestion } from "@/services/api/idealText";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";

/** The Confident Voice lane, by family OR by source: the wire sends it as
 *  kind 'bold' with `source` set, so a family-only check drops it into the
 *  rewrite face and asks the wrong question.
 *
 *  It lives here, beside the sort that puts it first, so the ordering rule and
 *  the card's own render read the same definition. (It was in sheetHeading.ts
 *  until 2026-09-15; that module's heading function is superseded by
 *  `stepTitle` below and the file is gone.) */
export function isConfidentVoiceFeedback(item: DocumentSuggestion): boolean {
  return (
    item.feedbackFamily === "confident_voice" ||
    item.source === "confident_voice"
  );
}

export type StepKind =
  | "feedback"
  | "suggestion"
  | "praise"
  | "emphasis"
  | "lock";

export type ChunkStep =
  | { kind: "feedback" | "suggestion" | "praise"; id: string }
  | { kind: "emphasis"; id: "emphasis" }
  | { kind: "lock"; id: "lock" };

export function isPraiseFeedback(item: DocumentSuggestion): boolean {
  return (
    item.feedbackFamily === "great_formulation" ||
    item.device === "impeccable"
  );
}

/** Which screen one feedback item gets. */
export function stepKindFor(
  item: DocumentSuggestion,
): "feedback" | "suggestion" | "praise" {
  if (isConfidentVoiceFeedback(item)) return "feedback";
  if (isPraiseFeedback(item)) return "praise";
  return "suggestion";
}

/** The inventory, confidence first, everything else in the order served.
 *
 *  A stable sort on one key — never a full re-rank. The Manager decided which
 *  three items exist and in what order they rank; this only lifts the
 *  confidence question to the front, and must not otherwise reorder its work
 *  (L2).
 */
export function orderedInventory(
  inventory: readonly DocumentSuggestion[],
): DocumentSuggestion[] {
  const confidence = inventory.filter(isConfidentVoiceFeedback);
  const rest = inventory.filter((item) => !isConfidentVoiceFeedback(item));
  return [...confidence, ...rest];
}

/** The whole ladder for one open sheet.
 *
 *  THE EMPHASIS STEP IS ALWAYS PRESENT when the paragraph has words to
 *  emphasise, whether or not a phrase was proposed. The handoff says both
 *  "the emphasis step if state.style exists" (§1) and "the emphasis step is
 *  now the only place a rooting phrase is ever chosen", with a third state for
 *  "none proposable" (§3). Those cannot both hold: the root face is deleted by
 *  this change, so gating the step on a proposal would leave a paragraph with
 *  no proposal unable to set a rooting phrase at all — a capability the old
 *  post-lock root face gave every paragraph. §3's "none proposable" state is
 *  only reachable under this reading, so this is the one taken. Flagged to the
 *  founder; one line to reverse if §1 was meant literally.
 *
 *  The lock step is always last and always present: every path through the
 *  sheet ends at the same question, which is what keeps the step bar a count
 *  of screens rather than of findings.
 */
export function buildChunkSteps(args: {
  inventory: readonly DocumentSuggestion[];
  /** False only when there is nothing to emphasise — an empty paragraph, or a
   *  confidence-only chunk the speaker did not call confident (see the gate in
   *  the modal: no orange anchor is created on that path). */
  canEmphasise: boolean;
}): ChunkStep[] {
  const steps: ChunkStep[] = orderedInventory(args.inventory).map((item) => ({
    kind: stepKindFor(item),
    id: item.id,
  }));
  if (args.canEmphasise) steps.push({ kind: "emphasis", id: "emphasis" });
  steps.push({ kind: "lock", id: "lock" });
  return steps;
}

/** The screen's own title. Copy lives in idealEditCopy, never here. */
export function stepTitle(kind: StepKind, reopenedClean: boolean): string {
  const copy = CHUNK_SHEET_COPY;
  if (kind === "lock") {
    return reopenedClean ? copy.titleEditChunk : copy.titleLock;
  }
  if (kind === "feedback") return copy.titleFeedback;
  if (kind === "praise") return copy.titlePraise;
  if (kind === "emphasis") return copy.titleEmphasis;
  return copy.titleSuggestion;
}

/** How far along the ladder we are, for the bar under the title.
 *
 *  AC-9: this counts SCREENS and nothing else. It must never encode how many
 *  problems were found or how confident the speaker sounded — a four-segment
 *  bar on one paragraph beside a three-segment bar on another would say
 *  exactly that, out loud, in a column. The lock step is always present, so
 *  the count is "how many decisions are in front of you", never a verdict.
 */
export function stepProgress(
  steps: readonly ChunkStep[],
  currentId: string | null,
): { total: number; current: number } {
  const index = steps.findIndex((step) => step.id === currentId);
  return { total: steps.length, current: index < 0 ? 0 : index };
}
