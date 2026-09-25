/* THE ANSWERED BOOKMARK (founder 2026-09-25, Q19 A / Q20 A / Q21 A).
 *
 * An unanswered bookmark opens on the judgement, as it always has. An
 * answered one opens on ONE screen, top to bottom:
 *   1. the exercise, if the moment has one;
 *   2. "You said: <answer>" in one line;
 *   3. what happened to the moment, in one or two small boxes;
 *   4. the rest of the history — the Slide's words Take by Take, and its
 *      helper words, now and before.
 *
 * Pure, so the sheet stays a renderer and the rules are tested here. Words
 * only: no score, band, rank or count reaches the screen (AC-9). The answer
 * is the owner's own self-report, never a coach label or a machine read (L3).
 */
import type {
  OwnerAnswer,
  ParagraphHistory,
} from "@/services/api/bookmarkHistory";

/** The five answers, labelled exactly as the judgement chips label them. */
const ANSWER_LABELS: Record<string, string> = {
  yes: "Yes",
  in_between: "In-between",
  no: "No",
  not_sure: "Not sure",
  audio_unclear: "Audio unclear",
};

export interface DecidedItemLite {
  id: string;
  status: "pending" | "approved" | "dismissed" | null;
  feedbackFamily?: "confident_voice" | "great_formulation" | "rewrite_clarity" | null;
  quote: string;
  proposedText: string | null;
}

export interface AnsweredCopy {
  historyCorrectionAccepted: string;
  historyPraised: string;
  historyFromPractice: string;
  historyTake: string;
  historyNow: string;
  historyBefore: string;
}

export interface LabelledLine {
  label: string | null;
  text: string;
}

export interface AnsweredView {
  youSaid: string | null;
  boxes: LabelledLine[];
  versions: LabelledLine[];
  helperWords: LabelledLine[];
}

/** One headline per Slide: all its helper words, in pick order (Q12 A,
 *  Q20 A). Slides without helper words get no entry and draw no headline. */
export function slideHeadlines(
  roots: readonly { slideIndex: number; text: string }[],
): Map<number, string> {
  const bySlide = new Map<number, string[]>();
  for (const root of roots) {
    const text = root.text.trim();
    if (!text) continue;
    const list = bySlide.get(root.slideIndex) ?? [];
    if (!list.includes(text)) list.push(text);
    bySlide.set(root.slideIndex, list);
  }
  const out = new Map<number, string>();
  for (const [slide, list] of bySlide) out.set(slide, list.join(" · "));
  return out;
}

/** "You said: …" — the owner's answer on this moment's Confident Voice item. */
function youSaidOf(
  items: readonly DecidedItemLite[],
  answers: readonly OwnerAnswer[],
): string | null {
  for (const item of items) {
    if (item.feedbackFamily !== "confident_voice") continue;
    const answer = answers.find((a) => a.feedbackId === item.id);
    const label = answer ? ANSWER_LABELS[answer.response] : undefined;
    if (label) return label;
  }
  return null;
}

/** What happened to the moment. At most two boxes (Q19 A): when a paragraph
 *  holds all three, the practice and the correction changed the words and
 *  the praise did not, so the praise is the one left out. */
function boxesOf(
  items: readonly DecidedItemLite[],
  history: ParagraphHistory | null,
  copy: AnsweredCopy,
): LabelledLine[] {
  const boxes: (LabelledLine & { praise?: boolean })[] = [];
  const correction = items.find(
    (i) =>
      i.feedbackFamily === "rewrite_clarity" &&
      i.status === "approved" &&
      (i.proposedText ?? "").trim(),
  );
  if (correction) {
    boxes.push({
      label: copy.historyCorrectionAccepted,
      text: (correction.proposedText ?? "").trim(),
    });
  }
  const praise = items.find(
    (i) => i.feedbackFamily === "great_formulation" && i.quote.trim(),
  );
  if (praise) {
    boxes.push({ label: copy.historyPraised, text: praise.quote.trim(), praise: true });
  }
  const adopted = [...(history?.practice ?? [])]
    .reverse()
    .find((p) => (p.after ?? "").trim());
  if (adopted) {
    boxes.push({
      label: copy.historyFromPractice,
      text: (adopted.after ?? "").trim(),
    });
  }
  const kept = boxes.length > 2 ? boxes.filter((b) => !b.praise) : boxes;
  return kept.map(({ label, text }) => ({ label, text }));
}

/** The Slide's words, newest first, each labelled with its Take. */
function versionsOf(
  history: ParagraphHistory | null,
  copy: AnsweredCopy,
): LabelledLine[] {
  return [...(history?.versions ?? [])]
    .filter((v) => v.paragraphs.some((p) => p.trim()))
    .reverse()
    .map((v) => ({
      label: v.takeIndex ? `${copy.historyTake} ${v.takeIndex}` : null,
      text: v.paragraphs.join("\n\n"),
    }));
}

/** Now, then every earlier set. An empty set is not a set of helper words. */
function helperWordsOf(
  history: ParagraphHistory | null,
  copy: AnsweredCopy,
): LabelledLine[] {
  const sets = (history?.helperWords ?? [])
    .map((h) => h.phrases.map((p) => p.trim()).filter(Boolean))
    .filter((phrases) => phrases.length > 0)
    .reverse();
  return sets.map((phrases, i) => ({
    label: i === 0 ? copy.historyNow : copy.historyBefore,
    text: phrases.join(" · "),
  }));
}

export function answeredView(args: {
  items: readonly DecidedItemLite[];
  answers: readonly OwnerAnswer[];
  history: ParagraphHistory | null;
  copy: AnsweredCopy;
}): AnsweredView {
  return {
    youSaid: youSaidOf(args.items, args.answers),
    boxes: boxesOf(args.items, args.history, args.copy),
    versions: versionsOf(args.history, args.copy),
    helperWords: helperWordsOf(args.history, args.copy),
  };
}

/** An answered bookmark: nothing on the paragraph is waiting, and at least
 *  one item on it was answered. Everything else opens as it always has. */
export function opensAnswered(state: {
  pending: readonly unknown[];
  decided?: readonly unknown[];
}): boolean {
  return state.pending.length === 0 && (state.decided?.length ?? 0) > 0;
}
