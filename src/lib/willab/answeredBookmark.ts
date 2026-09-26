/* THE ANSWERED BOOKMARK (founder 2026-09-25, Q19 A / Q20 A / Q21 A).
 *
 * An unanswered bookmark opens on the judgement, as it always has. An
 * answered one opens on ONE screen, top to bottom:
 *   1. the exercise, if the moment has one;
 *   2. "You have judged this as your <moment>" in one line;
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

/** The five answers, each said back as its own sentence. */
function judgedSentence(response: string, copy: AnsweredCopy): string | undefined {
  switch (response) {
    case "yes":
      return copy.historyJudgedYes;
    case "in_between":
      return copy.historyJudgedInBetween;
    case "no":
      return copy.historyJudgedNo;
    case "not_sure":
      return copy.historyJudgedNotSure;
    case "audio_unclear":
      return copy.historyJudgedAudioUnclear;
    default:
      return undefined;
  }
}

export interface DecidedItemLite {
  id: string;
  status: "pending" | "approved" | "dismissed" | null;
  feedbackFamily?: "confident_voice" | "great_formulation" | "rewrite_clarity" | null;
  quote: string;
  proposedText: string | null;
}

export interface AnsweredCopy {
  historyJudgedYes: string;
  historyJudgedInBetween: string;
  historyJudgedNo: string;
  historyJudgedNotSure: string;
  historyJudgedAudioUnclear: string;
  historyCorrectionAccepted: string;
  historyPraised: string;
  historyFromPractice: string;
  historyTake: string;
  historyNow: string;
}

export interface LabelledLine {
  label: string | null;
  text: string;
}

/** One Take in the paragraph's timeline (founder 2026-09-25, Q26 B): what
 *  was said, and the helper words that were locked while it stood. */
export interface TimelineEntry {
  label: string | null;
  text: string;
  helperWords: string | null;
}

export interface AnsweredView {
  youSaid: string | null;
  boxes: LabelledLine[];
  timeline: TimelineEntry[];
}

/** One headline per PARAGRAPH (founder 2026-09-26, superseding Q12 A's one
 *  headline per Slide): the helper words sit directly above the paragraph
 *  they came from, like a newspaper headline over its own article (contract
 *  clause 20, "above the Paragraph"). A paragraph with more than one set joins
 *  them in pick order. Paragraphs without helper words get no entry. */
export function paragraphHeadlines(
  roots: readonly { partId: string; text: string }[],
): Map<string, string> {
  const byPart = new Map<string, string[]>();
  for (const root of roots) {
    const text = root.text.trim();
    if (!text) continue;
    const list = byPart.get(root.partId) ?? [];
    if (!list.includes(text)) list.push(text);
    byPart.set(root.partId, list);
  }
  const out = new Map<string, string>();
  for (const [part, list] of byPart) out.set(part, list.join(" · "));
  return out;
}

/** Where a paragraph's helper words stand in its own text, for the italic
 *  inside the running text (founder 2026-09-26). Matched by their words,
 *  ignoring case, because helper words are stored as text rather than as a
 *  position (clause 14) — and a later Take need not say them at all, in which
 *  case there is simply nothing to mark. First occurrence of each phrase. */
export function helperWordRanges(
  text: string,
  headline: string | null | undefined,
): Array<[number, number]> | undefined {
  if (!headline) return undefined;
  const hay = text.toLowerCase();
  const out: Array<[number, number]> = [];
  for (const phrase of headline.split(" · ")) {
    const needle = phrase.trim().toLowerCase();
    if (!needle) continue;
    const at = hay.indexOf(needle);
    if (at >= 0) out.push([at, at + needle.length]);
  }
  return out.length > 0 ? out : undefined;
}

/** "You have judged this as your …" — the owner's answer on this moment's
 *  Confident Voice item, said back as one sentence. */
function youSaidOf(
  items: readonly DecidedItemLite[],
  answers: readonly OwnerAnswer[],
  copy: AnsweredCopy,
): string | null {
  for (const item of items) {
    if (item.feedbackFamily !== "confident_voice") continue;
    const answer = answers.find((a) => a.feedbackId === item.id);
    const label = answer ? judgedSentence(answer.response, copy) : undefined;
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

function time(value: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** The helper words locked while a version stood: the last locked set
 *  written before the next version replaced it (for the newest version, the
 *  set in force now). An empty set is no helper words. */
function helperWordsBefore(
  history: ParagraphHistory,
  until: number,
): string | null {
  let current: string[] = [];
  for (const set of history.helperWords) {
    if (time(set.at) >= until) break;
    current = set.phrases.map((p) => p.trim()).filter(Boolean);
  }
  return current.length > 0 ? current.join(" · ") : null;
}

/** One timeline, newest Take first (Q26 B): each Take's words and, under
 *  them, the helper words that were locked while they stood. */
export function timelineOf(
  history: ParagraphHistory | null,
  copy: Pick<AnsweredCopy, "historyTake">,
): TimelineEntry[] {
  if (!history) return [];
  const versions = history.versions.filter((v) =>
    v.paragraphs.some((p) => p.trim()),
  );
  const out: TimelineEntry[] = versions.map((v, i) => ({
    label: v.takeIndex ? `${copy.historyTake} ${v.takeIndex}` : null,
    text: v.paragraphs.join("\n\n"),
    helperWords: helperWordsBefore(
      history,
      i + 1 < versions.length
        ? time(versions[i + 1].at)
        : Number.POSITIVE_INFINITY,
    ),
  }));
  return out.reverse();
}

export function answeredView(args: {
  items: readonly DecidedItemLite[];
  answers: readonly OwnerAnswer[];
  history: ParagraphHistory | null;
  copy: AnsweredCopy;
}): AnsweredView {
  return {
    youSaid: youSaidOf(args.items, args.answers, args.copy),
    boxes: boxesOf(args.items, args.history, args.copy),
    timeline: timelineOf(args.history, args.copy),
  };
}

/** Which paragraphs open their own sheet rather than the judgement: nothing
 *  on them is waiting, and they were answered (Q19 A) or locked (Q26 B). A
 *  paragraph that is neither has nothing to show and opens nothing. */
export function opensParagraphSheet(state: {
  pending: readonly unknown[];
  decided?: readonly unknown[];
  locked?: boolean;
}): boolean {
  return (
    state.pending.length === 0 &&
    ((state.decided?.length ?? 0) > 0 || state.locked === true)
  );
}
