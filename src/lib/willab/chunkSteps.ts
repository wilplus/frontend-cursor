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
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
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

/** The words the confidence question was actually put about.
 *
 *  The Confident Voice candidate's own quote, which is the surface the
 *  rooting phrase may be tapped in (founder 2026-09-17). Null when the lane
 *  is absent or carries no quote, and `tokensWithinFragment` then shows the
 *  whole paragraph rather than dead-ending the step.
 *
 *  Here rather than in the sheet for two reasons: vitest cannot transform
 *  .tsx, so a rule left in the component is a rule no unit test can reach —
 *  and DeckChunkModal is grandfathered at the complexity ratchet, which a
 *  find-plus-fallback inline would have pushed over.
 */
export function confidentFragmentOf(
  items: readonly DocumentSuggestion[],
): string | null {
  return items.find(isConfidentVoiceFeedback)?.quote ?? null;
}

/** What the speaker answered, as the rooting step needs to read it.
 *
 *  The five real values where we have them; `"other"` from the two paths that
 *  cannot express more — the legacy agreement chip, and the exercise's own
 *  closing yes/no.
 */
export type RootGateAnswer = ConfidenceRatingValue | "other" | null;

/** Does this answer open the tap-to-root phrase step?
 *
 *  FOUNDER LOCK 2026-09-30 (B2, contract 24e): Yes and In-between open it.
 *  No, Not sure and Audio unclear do not. Helper words are the words of a
 *  confident moment; "I was not sure" is not a moment to build a cue on, and
 *  that moment still reaches the coach as an ambiguity. This narrows the
 *  2026-09-25 ruling, which also opened it on Not sure.
 *
 *  A No, Not sure or Audio unclear is not the end of the road: after an
 *  exercise the speaker practises and judges each attempt on the same five
 *  answers (29a), and that judgement supersedes this one. A Yes or In-between
 *  there opens this step with the practice's words. The same rule reads here
 *  for both, so the walk, the paragraph sheet and the practice loop can never
 *  disagree.
 *
 *  `"other"` is what the older coarse paths report (the legacy agreement
 *  chip); it keeps the step, as before. Nobody having answered — a paragraph
 *  the detector never flagged — still closes it.
 */
export function opensRootPhrase(answer: RootGateAnswer): boolean {
  return (
    answer !== null &&
    answer !== "no" &&
    answer !== "not_sure" &&
    answer !== "audio_unclear"
  );
}

/** Does this answer take the Lock step off the end of the ladder?
 *
 *  FOUNDER LOCK 2026-09-30 (B2): the ladder ends after the feedback on No,
 *  Not sure and Audio unclear, the three answers with no helper-words step.
 *  Until then Not sure kept its Lock (founder 2026-09-25, Q1 B).
 *
 *  `"other"` keeps the Lock, as before: it is what the older coarse paths
 *  report, and a judgement of a different recording is not this rule.
 */
export function closesLock(answer: RootGateAnswer): boolean {
  return answer === "no" || answer === "not_sure" || answer === "audio_unclear";
}

/** Does the lock step SHOW the paragraph rather than offer it for editing?
 *
 *  FOUNDER 2026-09-17: "on the lock-in screen show the whole text that is
 *  being locked in WITH the boldening and orange that was tapped in the step
 *  earlier." Confirming a decision means seeing what you are confirming — the
 *  step drew a plain editor, so the phrase just chosen was invisible at the
 *  exact moment it was being committed.
 *
 *  So: a paragraph already settled shows (it always did), and one carrying a
 *  chosen phrase now shows too, with that phrase in the accent. Everything
 *  else still opens the editor, because editing has to stay reachable and a
 *  separate screen for it would put two decisions on one path.
 *
 *  Here rather than inline because DeckChunkModal is grandfathered at the
 *  complexity ratchet and may only come down — and because a rule in a .tsx
 *  is a rule vitest cannot reach.
 */
export function locksAsPreview(state: {
  locked: boolean;
  hadFeedback: boolean;
  chosenPhrase: string | null;
}): boolean {
  if (state.chosenPhrase) return true;
  return state.locked && !state.hadFeedback;
}

export type StepKind =
  | "feedback"
  | "suggestion"
  | "praise"
  | "exercise"
  | "emphasis"
  | "lock";

export type ChunkStep =
  | { kind: "feedback" | "suggestion" | "praise"; id: string }
  /** `exercise` is the deterministic catalogue practice (useConfidenceExercise);
   *  `service_exercise` is the MLC-3 service offer for a served Confident
   *  Voice item; `coach_request` is the same screen with no exercise on it,
   *  saying the bookmark went to the coach (founder 2026-09-29). A ladder
   *  holds at most one of the three. */
  | { kind: "exercise"; id: "exercise" | "service_exercise" | "coach_request" }
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
 *  THE EMPHASIS GATE (founder 2026-09-16 §4, widened 09-22, finished 09-24).
 *  The step requires a paragraph with words and an ANSWER — see
 *  `opensRootPhrase`, which as of 2026-09-24 is every answer there is. A
 *  paragraph the detector never flagged is never judged, so it reaches the end
 *  with no orange at all; that is the intended shape, not an oversight.
 *
 *  THE EXERCISE STEP sits between the feedback items and emphasis. It is the
 *  only place the asynchronous side of the product surfaces in this sheet,
 *  and it is offered on a Yes and on a No alike: the practice is matched to
 *  the clip, not awarded for a verdict.
 *
 *  THE LOCK STEP IS NO LONGER ALWAYS THERE, and the sentence that used to
 *  stand here — "the lock step is always last and always present: every path
 *  through the sheet ends at the same question" — is retired rather than
 *  quietly left in place. Founder 2026-09-24: an answer of No, Not sure or
 *  Audio unclear takes the step off the end entirely, and the sheet closes
 *  when the ladder runs out. Not a disabled Lock and not a Keep evolving in
 *  its place: "just don't show that overlay".
 *
 *  What the caller must know about that: the ladder can now END on a screen
 *  that is not the lock, so advancing past the last step is a real branch and
 *  it is the close. It can never be empty, though — `canLock` is only false
 *  once a judgement exists, a judgement only exists once a Confident Voice
 *  item has been answered, and that item is itself a step in this list.
 *
 *  The step bar therefore gets shorter on those answers. It still counts
 *  SCREENS and only screens (AC-9): the speaker's own answer changing how many
 *  decisions are left is not the machine reporting a verdict about them.
 */
export function buildChunkSteps(args: {
  inventory: readonly DocumentSuggestion[];
  /** An exercise matched to this exact clip, still open. */
  canPractise?: boolean;
  /** The MLC-3 service allowed an exercise on the answer just given. Only
   *  consulted when no catalogue exercise is attached — one rung, never two. */
  canPractiseService?: boolean;
  /** No exercise on the moment and the answer sent it to the coach
   *  (founder 2026-09-29): the Exercise screen says so instead. Consulted
   *  only when neither exercise rung exists. */
  canNotice?: boolean;
  /** A phrase is proposable AND the paragraph has been answered. Both halves
   *  are the caller's to establish — see the gate in the modal. */
  canEmphasise: boolean;
  /** May this paragraph still be locked? False on the three answers in
   *  `closesLock`, and then the ladder simply ends earlier. Defaults to true
   *  so an older caller keeps the pre-2026-09-24 ladder exactly. */
  canLock?: boolean;
}): ChunkStep[] {
  const steps: ChunkStep[] = orderedInventory(args.inventory).map((item) => ({
    kind: stepKindFor(item),
    id: item.id,
  }));
  if (args.canPractise) steps.push({ kind: "exercise", id: "exercise" });
  else if (args.canPractiseService) {
    steps.push({ kind: "exercise", id: "service_exercise" });
  } else if (args.canNotice) {
    steps.push({ kind: "exercise", id: "coach_request" });
  }
  if (args.canEmphasise) steps.push({ kind: "emphasis", id: "emphasis" });
  if (args.canLock !== false) steps.push({ kind: "lock", id: "lock" });
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
  if (kind === "exercise") return copy.titleExercise;
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

/** The status the server serves for an answered Confident Voice row (24g-1):
 *  a Yes keeps the ladder open and reads "approved"; every other answer has
 *  been dealt with and reads "dismissed". Mirrors `decided_status` in the
 *  backend, so the page and the server never disagree between a save and the
 *  refetch that confirms it. */
export function judgedStatus(
  answered: "yes" | "other",
): "approved" | "dismissed" {
  return answered === "yes" ? "approved" : "dismissed";
}
