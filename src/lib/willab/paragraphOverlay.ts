/* THE PARAGRAPH OVERLAY (founder lock 2026-09-30, B5, D1, D3, D6, D7, Q1).
 *
 * The paragraph's own sheet has exactly two states and never shows the
 * paragraph text (D6):
 *
 *   PRACTISE  player · "Your judgement: …" · one practise card · History ·
 *             Practise with Skip, or Next (with Practise as a link on
 *             In-between, Q1 B)
 *   SAVED     player · the helper words · History · Next
 *
 * The rules that choose the card, the button and the label's colour live
 * here, pure, so the sheet stays a renderer and vitest can reach them (it
 * cannot transform .tsx). Words only: the label is the speaker's own answer
 * said back (L3), never the machine's read, which has no colour anywhere on
 * the overlay (D7, AC-9).
 */
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import {
  isConfidentVoiceFeedback,
  isPraiseFeedback,
  opensRootPhrase,
} from "./chunkSteps";

/** The five answers the overlay can say back. */
export type Judgement =
  | "yes"
  | "in_between"
  | "no"
  | "not_sure"
  | "audio_unclear";

const FIVE: ReadonlySet<string> = new Set([
  "yes",
  "in_between",
  "no",
  "not_sure",
  "audio_unclear",
]);

/** A stored answer as one of the five, or null (nothing to say back). */
export function asJudgementValue(answer: string | null | undefined): Judgement | null {
  return answer && FIVE.has(answer) ? (answer as Judgement) : null;
}

/** The label's colour (D7): green for Yes, blue for In-between, red for
 *  No, yellow for Not sure, grey for Audio unclear. */
export type LabelTone = "green" | "blue" | "red" | "yellow" | "grey";

export function judgementTone(judgement: Judgement): LabelTone {
  switch (judgement) {
    case "yes":
      return "green";
    case "in_between":
      return "blue";
    case "no":
      return "red";
    case "not_sure":
      return "yellow";
    default:
      return "grey";
  }
}

/** Below In-between: the answers whose default follow-up is Practise (D1). */
export function belowInBetween(judgement: Judgement | null): boolean {
  return judgement === "no" || judgement === "not_sure";
}

/** ONE MAIN CARD (B5): the passage the speaker is asked to practise, or
 *  the praise, as one card. An exercise carries its video inside the card
 *  above its instruction. */
export type PractiseCard =
  | {
      kind: "exercise";
      item: DocumentSuggestion;
      video: string | null;
      instruction: string | null;
      passage: string;
    }
  /** `move`: the catalogue's signed sentence for the rewrite's reason (35f),
   *  or null. */
  | { kind: "rewrite"; item: DocumentSuggestion; text: string; move: string | null }
  | {
      kind: "praise";
      item: DocumentSuggestion;
      text: string;
      tentative: boolean;
      cueKeys: readonly string[];
      /** The catalogue's signed line for this praise (35f), or null: the
       *  sheet then keeps its constant per cue. */
      line: string | null;
    }
  /** Nothing matched the moment (D1): the plain moment, said again. `coach`
   *  when the bookmark went to the coach as an error and nothing came back
   *  yet, so the signed sentence rides under it (Q5). */
  | { kind: "plain"; item: DocumentSuggestion | null; text: string; coach: boolean };

/** Does the exercise open on this answer? The library video on In-between,
 *  No and Not sure (the follow-up matrix, 24f); one the coach chose on any
 *  answer but Audio unclear. */
function exerciseOpens(judgement: Judgement | null, item: DocumentSuggestion): boolean {
  if (judgement === "audio_unclear") return false;
  if (judgement === "in_between" || belowInBetween(judgement)) return true;
  return item.practiceExercise?.chosenByCoach === true;
}

/** The moment's bookmark is with the coach as an ERROR and nothing has come
 *  back yet: the one kind the coach always answers with a video, so the
 *  sentence is a promise kept (founder 2026-09-29, Q6). */
export function coachHasIt(items: readonly DocumentSuggestion[]): boolean {
  return items.some(
    (item) =>
      isConfidentVoiceFeedback(item) &&
      !item.practiceExercise &&
      item.coachRequest?.status === "open" &&
      item.coachRequest.kind === "error",
  );
}

/** The exercise this moment carries, if any: the same exact-clip offer the
 *  judgement sheet would have shown. */
export function exerciseOf(
  items: readonly DocumentSuggestion[],
): DocumentSuggestion | null {
  return (
    items.find(
      (item) =>
        isConfidentVoiceFeedback(item) &&
        item.practiceExercise &&
        item.snippetId &&
        item.evidence,
    ) ?? null
  );
}

function rewriteOf(items: readonly DocumentSuggestion[]): DocumentSuggestion | null {
  return (
    items.find(
      (item) =>
        (item.feedbackFamily === "rewrite_clarity" || item.kind === "replace") &&
        (item.proposedText ?? "").trim().length > 0,
    ) ?? null
  );
}

function praiseOf(items: readonly DocumentSuggestion[]): DocumentSuggestion | null {
  return items.find((item) => isPraiseFeedback(item) && item.quote.trim()) ?? null;
}

/** Which card the overlay shows (B5, D1, D3). Audio unclear shows none.
 *
 *  An exercise wins where it opens; otherwise the praise leads on a Yes
 *  (the moment landed) and the rewrite leads below it (the passage to say
 *  better); a No or Not sure with nothing matched is the plain moment, so
 *  no judgement ends on an overlay with nothing to do (D1). A paragraph
 *  never judged shows its rewrite or praise, if it has one, else nothing. */
export function practiseCardOf(
  items: readonly DocumentSuggestion[],
  judgement: Judgement | null,
  paragraphText: string,
): PractiseCard | null {
  if (judgement === "audio_unclear") return null;
  const exercise = exerciseOf(items);
  if (exercise?.practiceExercise && exerciseOpens(judgement, exercise)) {
    const offer = exercise.practiceExercise;
    return {
      kind: "exercise",
      item: exercise,
      video: offer.explanationVideoRef ?? null,
      instruction: (offer.instruction ?? "").trim() || null,
      passage: offer.passage || exercise.quote || paragraphText,
    };
  }
  const rewrite = rewriteOf(items);
  const praise = praiseOf(items);
  // THE MATRIX ON A YES (24f; F1 Repair Plan Phase 6): a Yes shows the
  // praise where the machine found one and nothing else -- a Yes on a moment
  // read weak used to fall through to the rewrite, where the matrix says
  // nothing now.
  const ordered = judgement === "yes" ? [praise] : [rewrite, praise];
  for (const item of ordered) {
    if (!item) continue;
    if (item === praise) {
      return {
        kind: "praise",
        item,
        text: item.quote.trim(),
        tentative: item.tentative === true,
        cueKeys: item.cueKeys ?? [],
        line: item.praiseLine ?? null,
      };
    }
    return {
      kind: "rewrite",
      item,
      text: (item.proposedText ?? "").trim(),
      move: item.rewriteMove ?? null,
    };
  }
  if (!belowInBetween(judgement)) return null;
  const moment = items.find(isConfidentVoiceFeedback) ?? null;
  return {
    kind: "plain",
    item: moment,
    text: moment?.quote.trim() || paragraphText,
    coach: coachHasIt(items),
  };
}

/** THE BUTTON (B5 as overridden; Q1 B): Next on a Yes or In-between, with
 *  Practise as the plain-text link on In-between; Practise with Skip on No
 *  and Not sure. Audio unclear, and a paragraph never judged, read Next.
 *
 *  `canPractise` is whether a practise can open on the card shown. Until the
 *  practise loop reaches the rewrite and the plain moment (task 6), a No or
 *  Not sure whose card cannot be practised reads Next: the card is shown,
 *  and the button is honest about what it does. */
export function overlayFooter(
  judgement: Judgement | null,
  canPractise: boolean,
  canAccept = false,
): {
  pill: "next" | "practise" | "accept";
  link: "skip" | "practise" | "keep" | null;
} {
  // THE REWRITE IS ACCEPTED, THEN SAID (founder 2026-09-30, the rewrite
  // amendment and C11; contract 29b): on an In-between, a No or a Not sure
  // whose card is a rewrite still open, the one button accepts the words
  // and opens the practise on them; "Keep my words" is the way out. A Yes
  // never accepts anything.
  if (canAccept && judgement !== "yes" && judgement !== null) {
    return { pill: "accept", link: "keep" };
  }
  if (judgement === "in_between") {
    return { pill: "next", link: canPractise ? "practise" : null };
  }
  if (belowInBetween(judgement) && canPractise) {
    return { pill: "practise", link: "skip" };
  }
  return { pill: "next", link: null };
}

/** Can the card be accepted (29b)? A rewrite with words to propose, still
 *  open, on a judgement that is not Yes, with a host to write the decision. */
export function canAcceptCard(
  card: PractiseCard | null,
  judgement: Judgement | null,
  hasHost: boolean,
): boolean {
  return (
    hasHost &&
    card !== null &&
    card.kind === "rewrite" &&
    card.text.length > 0 &&
    card.item.status !== "approved" &&
    judgement !== null &&
    judgement !== "yes" &&
    judgement !== "audio_unclear"
  );
}

/** The plain moment as the card to practise with one's own words (29b,
 *  "Keep my words" below In-between). */
export function ownWordsCard(
  items: readonly DocumentSuggestion[],
  paragraphText: string,
): PractiseCard {
  const moment = items.find(isConfidentVoiceFeedback) ?? null;
  return {
    kind: "plain",
    item: moment,
    text: moment?.quote.trim() || paragraphText,
    coach: false,
  };
}

/** Does Next open the helper-words picker (24e, B2)? After a Yes or an
 *  In-between on a paragraph whose words are not saved yet. */
export function nextOpensPicker(
  judgement: Judgement | null,
  headline: string | null,
): boolean {
  return opensRootPhrase(judgement) && !headline;
}

/** One collapsed History row (Q1): earlier Takes as single rows, each the
 *  Take number, the answer and the helper words. Nothing else. */
export interface HistoryRow {
  label: string;
  answer: Judgement | null;
  helperWords: string | null;
}

function time(value: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** The helper words a version held: the last set saved before the next
 *  version replaced it (mirrors answeredBookmark). A DELETED SET STAYS IN
 *  HISTORY (founder lock 2026-09-30, B4/D4; contract 13; F1 Repair Plan
 *  Phase 5): a delete is logged as an empty set, and an empty set no longer
 *  wipes the words the version held before it. */
function helperWordsBefore(history: ParagraphHistory, until: number): string | null {
  let current: string[] = [];
  for (const set of history.helperWords) {
    if (time(set.at) >= until) break;
    const phrases = set.phrases.map((p) => p.trim()).filter(Boolean);
    if (phrases.length > 0) current = phrases;
  }
  return current.length > 0 ? current.join(" · ") : null;
}

/** Whether the words saved while the newest version stands were deleted
 *  since: then that version's row is History too, not the Take on screen
 *  alone, or the deleted set would vanish. */
function deletedSinceNewest(history: ParagraphHistory, since: number): boolean {
  let held = false;
  let last: string[] | null = null;
  for (const set of history.helperWords) {
    if (time(set.at) < since) continue;
    last = set.phrases.map((p) => p.trim()).filter(Boolean);
    if (last.length > 0) held = true;
  }
  return held && last !== null && last.length === 0;
}

export function historyRows(
  history: ParagraphHistory | null,
  takeWord: string,
): HistoryRow[] {
  if (!history) return [];
  const versions = history.versions.filter((v) => v.paragraphs.some((p) => p.trim()));
  const rows = versions.map((v, i) => ({
    label: v.takeIndex ? `${takeWord} ${v.takeIndex}` : takeWord,
    answer: asJudgementValue(v.answer),
    helperWords: helperWordsBefore(
      history,
      i + 1 < versions.length ? time(versions[i + 1].at) : Number.POSITIVE_INFINITY,
    ),
  }));
  // Newest first, and the newest itself is the Take on screen, not history
  // -- unless words saved during it were deleted since (Phase 5).
  const newest = versions[versions.length - 1];
  const keepNewest = newest ? deletedSinceNewest(history, time(newest.at)) : false;
  return keepNewest ? rows.reverse() : rows.reverse().slice(1);
}

/* -------------------------------------------------------------------------- */
/*  JUDGEMENT AFTER FEEDBACK (contract 24e-1; F1 Repair Plan Phase 6).        */
/*                                                                            */
/*  "Opening a bookmark never asks for a judgment first. The machine's read  */
/*  chooses the feedback. The speaker judges themselves after it: on a       */
/*  confident moment right after the praise, on a moment that needed work    */
/*  after each practice attempt." The paragraph sheet opens on the card the  */
/*  machine's read chooses, with the strings and footer pieces it already    */
/*  has: on a confident moment Next asks the judgement; on a moment that     */
/*  needed work the card is practised (each attempt judged in the practise   */
/*  loop) or skipped. FEEDBACK_FIRST is the one switch back to the old       */
/*  order.                                                                   */
/* -------------------------------------------------------------------------- */

export const FEEDBACK_FIRST = true;

export type MachineRead = "confident" | "weak" | null;

/** The machine's read of the moment, from the tier V3 served it with. */
export function machineReadOf(items: readonly DocumentSuggestion[]): MachineRead {
  const moment = items.find(isConfidentVoiceFeedback);
  if (moment?.bookmarkTier === "confident") return "confident";
  if (moment?.bookmarkTier === "weak") return "weak";
  return null;
}

/** The card before any judgement: the praise on a confident moment; on a
 *  moment that needed work the exercise matched to its clip, else the
 *  rewrite, else the moment to say again; a moment the machine could not
 *  read shows its rewrite if it has one. */
export function feedbackFirstCard(
  items: readonly DocumentSuggestion[],
  read: MachineRead,
  paragraphText: string,
): PractiseCard | null {
  if (read === "confident") return practiseCardOf(items, "yes", paragraphText);
  if (read === "weak") return practiseCardOf(items, "no", paragraphText);
  const rewrite = practiseCardOf(items, "no", paragraphText);
  return rewrite?.kind === "rewrite" ? rewrite : null;
}

/** The button before any judgement: on a confident moment, or with nothing
 *  to practise, Next (it asks the judgement); a rewrite still open, Accept
 *  and practise with Keep my words (29b); anything else practisable,
 *  Practise with Skip. */
export function feedbackFirstFooter(
  read: MachineRead,
  canPractise: boolean,
  canAccept: boolean,
): { pill: "next" | "practise" | "accept"; link: "skip" | "practise" | "keep" | null } {
  if (read === "confident" || !canPractise) return { pill: "next", link: null };
  if (canAccept) return { pill: "accept", link: "keep" };
  return { pill: "practise", link: "skip" };
}

/** What was on screen at the open, for the backend's record (0408). */
export function shownAtOpen(card: PractiseCard | null): ("praise" | "rewrite" | "exercise" | "coach_request")[] {
  if (!card) return [];
  if (card.kind === "plain") return card.coach ? ["coach_request"] : [];
  return [card.kind];
}

