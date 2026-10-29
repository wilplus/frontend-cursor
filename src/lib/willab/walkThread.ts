/* -------------------------------------------------------------------------- */
/*  THE WALK'S STEPS IN THE LOUNGE (founder lock 2026-10-12, moment and        */
/*  feedback chat, section 1): one thread, stored once. Each step the walk     */
/*  shows, and each answer the speaker gives, is one Lounge message of kind    */
/*  "walk_step". Its id is fixed by the Take, the step, the moment, the try    */
/*  and the author, so a step seen twice (‹ and ›, a replay) is stored once.  */
/*                                                                            */
/*  Pure. The words are the walk's own (the moment's, the signed bank's);     */
/*  no number, read or score (AC-9).                                          */
/* -------------------------------------------------------------------------- */

import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import type { FeedbackWalkMoment, WalkStepTarget } from "./feedbackWalkModel";
import type { PraiseReason } from "./praiseReason";
import { clearerOpening, topMomentLine, type WalkBankKey } from "./walkLines";
import type { WalkStep } from "./walkPlan";
import { encourageLine, improvedLine, thanksLine } from "./walkPractise";

export type WalkAuthor = "app" | "coach" | "speaker";

export type WalkThreadEntry = {
  take: string;
  arcId: string | null;
  /** The Take's number ("🔒 Take N" once a newer Take exists). */
  takeIndex?: number | null;
  key: string;
  moment: number | null;
  attempt: number | null;
  author: WalkAuthor;
  body: string;
  /** More for the chat to draw: the label above a moment, the speaker's
   *  clip, the helper words a pick replaces. */
  extra?: Record<string, unknown>;
};

/** A UUID fixed by `seed`: the same seed, the same id. */
export function stableUuid(seed: string): string {
  const parts: string[] = [];
  for (let salt = 0; salt < 4; salt += 1) {
    let h = 0x811c9dc5 ^ salt;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    parts.push(h.toString(16).padStart(8, "0"));
  }
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** The Lounge message for one entry. */
export function walkStepDraft(e: WalkThreadEntry): LoungeMessageDraft {
  return {
    role: e.author === "speaker" ? "user" : "bot",
    kind: "walk_step",
    body: e.body,
    clientId: stableUuid([e.take, e.key, e.moment ?? "", e.attempt ?? "", e.author].join("|")),
    metadata: {
      take_session_id: e.take,
      arc_id: e.arcId,
      take_index: e.takeIndex ?? null,
      step: e.key,
      moment: e.moment,
      attempt: e.attempt,
      author: e.author,
      ...e.extra,
    },
  };
}

/** Whether the walk writes the coach's word for the Take into the chat
 *  (founder 2026-10-19, N80, D4): once per Take, by whichever comes first.
 *  Never in a replay; never for an earlier Take's word shown as Step 0 of a
 *  later one; never when the loaded chat already holds the coach's word for
 *  this Take (the walk's own copy, the "Later · from your coach" bubble or
 *  the in-review bubble), so there is no second copy and nothing jumps to
 *  the bottom. Never while the chat is still loading: what it holds is not
 *  known yet, so a copy now could be a second one. Pure. */
export function coachNoteToChat(
  thread: { readonly messages: readonly LoungeMessage[]; readonly loading: boolean } | null,
  pageTake: string | null,
  wordTake: string | null,
  replay: boolean,
): boolean {
  if (replay || !pageTake || wordTake !== pageTake || thread?.loading === true) return false;
  return !(thread?.messages ?? []).some((m) => {
    const meta = m.metadata ?? {};
    return m.kind === "walk_step" && meta.take_session_id === pageTake && meta.step === "coachnote" && meta.author === "coach";
  });
}

const CHAT_MOMENT_STEPS = new Set(["praise", "clearer", "exVideo"]);

/** What the chat draws with a moment's step (prototype v31, lens off): the
 *  label above it ("Slide 2 · moment 1 of 2", or "Slide 3"), and the
 *  speaker's clip as their orange bubble (on a clearer version, their words
 *  with what goes struck). Null: the step has neither. */
export function momentChat(
  plan: readonly WalkStep[],
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown> | null,
): { label: Record<string, unknown>; clip: Record<string, unknown> | null } | null {
  if (!moment || !CHAT_MOMENT_STEPS.has(step.key)) return null;
  // A praised moment's practise follows its praise (N122): its clip and
  // label are already just above.
  if (step.key === "exVideo" && moment.praised) return null;
  const slide = moment.slideLabel && /^Slide \d+$/.test(moment.slideLabel) ? moment.slideLabel : null;
  const greens = plan.filter((s) => s.key === "praise").map((s) => s.moment);
  const label =
    step.key === "praise"
      ? { slide_label: slide, green_n: greens.indexOf(moment.index) + 1, green_of: greens.length }
      : { slide_label: slide };
  const words = step.key === "clearer" ? (moment.clearer?.before ?? null) : null;
  const clip =
    moment.clip || words
      ? {
          src: moment.clip?.src ?? null,
          start_ms: moment.clip?.startOffsetMs ?? null,
          duration_ms: moment.clip?.durationMs ?? null,
          snippet_id: moment.clip?.snippetId ?? null,
          words,
        }
      : null;
  return { label, clip };
}

/** The sharing question's three lines as one bubble, a blank line between
 *  them (founder 2026-10-19). */
const SHARE_QUESTION = [WALK_COPY.shareBefore, WALK_COPY.shareTitle, WALK_COPY.shareAudience].join("\n\n");

/** Sharing before the next recording, in the chat (prototype v31, lens
 *  off): "Record Take N", the question as one bubble, and the speaker's
 *  choice. */
export function shareChat(
  nextTake: number | null,
  ticks: readonly string[],
  communities: readonly string[],
  arcId: string | null = null,
): LoungeMessageDraft[] {
  const say = (role: "user" | "bot", body: string): LoungeMessageDraft => ({
    role,
    kind: "walk_step",
    body,
    metadata: { step: "share", author: role === "user" ? "speaker" : "app", arc_id: arcId },
  });
  const choice = ticks
    .map((t) =>
      t === "mine"
        ? `${WALK_COPY.shareMine} (${communities.join(", ")})`
        : t === "general"
          ? WALK_COPY.shareGeneral
          : WALK_COPY.shareOnlyMe,
    )
    .join(", ");
  return [
    ...(nextTake ? [say("user", `Record Take ${nextTake}`)] : []),
    say("bot", SHARE_QUESTION),
    say("user", choice),
  ];
}

/** The bridge line before other speakers' moments (lock 2026-10-12,
 *  sections 2.6 and 9): from the speaker's community when the moments are
 *  its own, else from other speakers. */
export function othersBridge(of: number, from: string | null): string {
  if (from) return of === 1 ? WALK_COPY.othersOneFrom(from) : WALK_COPY.othersManyFrom(of, from);
  return of === 1 ? WALK_COPY.othersOne : WALK_COPY.othersMany(of);
}

const FACES: Record<string, string> = {
  yes: `👍 ${WALK_COPY.judgeYes}`,
  in_between: `😐 ${WALK_COPY.judgeInBetween}`,
  no: `👎 ${WALK_COPY.judgeNo}`,
  audio_unclear: WALK_COPY.judgeUnclear,
};

/** Judging other speakers in the chat (prototype v31 `judge`, lens off):
 *  "Other speakers" (or the community) above the first, the bridge or
 *  "Moment n of N" with the question under it, and the speaker's answer as
 *  their own bubble ("👍 Yes"). Their clip is not posted: it is someone
 *  else's recording, and the chat draws none. Null: nothing to post. */
export function othersChat(
  at: number,
  of: number,
  from: string | null,
  answer: string | null,
): Omit<WalkThreadEntry, "take" | "arcId"> | null {
  const where = { moment: null, attempt: at + 1 };
  if (answer) return FACES[answer] ? { key: "answer:others", ...where, author: "speaker", body: FACES[answer] } : null;
  return {
    key: "others",
    ...where,
    author: "app",
    body: at === 0 ? othersBridge(of, from) : `Moment ${at + 1} ${COPY.pagerOf} ${of}`,
    extra: { hint: COPY.confidenceQuestion, ...(at === 0 ? { heading: from ?? WALK_COPY.othersTitle } : {}) },
  };
}

/** The tempo step as the chat kept it in `take`'s walk (N166 step 4): Will's
 *  opening lines, each "Try N" with the dot's line and its comment, the
 *  closing line or the Skip, in order. A walk opened again shows them (B5,
 *  N247). Pure. */
export function tempoSaidIn(messages: readonly LoungeMessage[], take: string): WalkTempoLine[] {
  return messages
    .filter((m) => m.kind === "walk_step" && m.metadata?.take_session_id === take && String(m.metadata?.step ?? "").startsWith("tempo:") && m.body.trim())
    .map((m) => {
      const path = m.metadata?.path;
      const line: WalkTempoLine = { author: m.role === "user" ? "speaker" : "app", body: m.body.trim() };
      return Array.isArray(path) && path.every((v) => typeof v === "number" && v >= 0 && v <= 1) ? { ...line, path } : line;
    });
}

/** One line of the tempo step as the chat kept it; a try has the dot's line. */
export type WalkTempoLine = { author: "app" | "speaker"; body: string; path?: readonly number[] };

/** How many of other speakers' moments the speaker judged in `take`'s walk:
 *  their "👍 Yes" bubbles in the chat (`answer:others`). The judging
 *  reopened from the Lounge shows that many, answered. Pure. */
export function othersAnswered(messages: readonly LoungeMessage[], take: string): number {
  return messages.filter(
    (m) => m.kind === "walk_step" && m.metadata?.take_session_id === take && m.metadata?.step === "answer:others",
  ).length;
}

/** The paragraphs whose helper words were picked in `take`'s walk: each
 *  pick is the speaker's bubble, stored with its Take and paragraph
 *  (`words_of`). Words kept from an earlier Take are not among them, so they
 *  never settle this Take's moment (founder 2026-10-21). Pure. */
export function wordsPickedIn(messages: readonly LoungeMessage[], take: string | null): Set<string> {
  const out = new Set<string>();
  for (const m of messages) {
    const words = m.metadata?.words_of;
    if (m.kind === "walk_step" && m.metadata?.take_session_id === take && typeof words === "string") out.add(words);
  }
  return out;
}

/** The speaker's answer to a step as their own bubble says it, in the
 *  walk's chat and the Lounge alike. Null: posted elsewhere (helper words, a
 *  clearer version's choice), or nothing to say: Practise and Practise
 *  again write nothing, the try itself is the speaker's bubble (founder
 *  2026-10-20, WIL-89). */
/** Helper words as the speaker's own bubble says them: the words picked,
 *  without the sentence's punctuation at either end ("growth doubled," →
 *  "growth doubled"; founder 2026-10-21, B7). The words saved on the text
 *  keep theirs. Pure. */
export function helperWordsSaid(words: string): string {
  return words.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "") || words;
}

export function answerBody(step: WalkStep, value: string): string | null {
  if (value === "skip" && ["helpers", "exVideo", "encourage"].includes(step.key)) return WALK_COPY.skip;
  return null;
}

/** The AI bubble a step showed (N71), as the chat stores it: its lines, and
 *  the practice whose clip the chat fetches afresh (a link expires).
 *  `fallback`: the step's plain words, which the chat shows instead when the
 *  clip never comes (founder 2026-10-20: a clip on its way is posted as the
 *  AI bubble at once, and a stored message is never rewritten). */
export function aiVoiceChat(
  ai: { title?: string; lead?: string; line: string; then?: string; practiceId: string },
  fallback: string | null = null,
): {
  author: WalkAuthor;
  body: string;
  extra: Record<string, unknown>;
} {
  return {
    author: "app",
    body: [ai.title, ai.lead, ai.line, ai.then].filter(Boolean).join("\n"),
    extra: { ai_voice: { practice_id: ai.practiceId, then: ai.then ?? null, ...(fallback ? { fallback } : {}) } },
  };
}

/** A green moment in the chat once its reason is known: the title and the
 *  praise line, then the reason's paragraphs, as the walk draws them
 *  (founder 2026-10-18). Pure. */
export function praiseChat(
  moment: FeedbackWalkMoment<unknown>,
  reason: PraiseReason,
): { author: WalkAuthor; body: string } {
  const lead = (moment.praiseLead ?? moment.praiseWords).join(" ");
  const lines = [
    ...(moment.highest ? [COPY.titleMostConfident] : []),
    moment.praiseTitle ?? COPY.titlePraise,
    lead,
    ...reason.paragraphs,
  ];
  return { author: "app", body: lines.filter((line) => line.trim() !== "").join("\n") };
}

/** The Exercise's bubble: its instruction, no title (founder 2026-10-21, K:
 *  "Exercise" is no longer shown), with the video's
 *  thumb (prototype v31 `vthumb`) from the exercise's stored link (a library
 *  or coach upload's public address); the walk's own line when the moment
 *  has no exercise yet. */
function exerciseChat(
  moment: FeedbackWalkMoment<unknown> | null,
): { author: WalkAuthor; body: string; extra?: Record<string, unknown> } | null {
  // A praised moment's practise has the AI clip or nothing (N122): never
  // Line A, and no plain words to stand in for a clip that never comes.
  if (!moment || moment.praised) return null;
  const ex = moment.exercise;
  // On the confident moment itself its own line, for what follows (an
  // example only with a video to show), and no Line A (founder 2026-10-21).
  const top = Boolean(moment.highest);
  const head = top ? `${topMomentLine(ex?.video ? "example" : "again", moment)}\n` : "";
  const line = ex?.instruction ?? (top ? "" : WALK_COPY.lineA);
  if (!ex) return { author: "app", body: `${head}${line}`.trim() };
  return {
    author: ex.byCoach ? "coach" : "app",
    body: `${head}${line}`.trim(),
    ...(ex.video ? { extra: { video: ex.video } } : {}),
  };
}

/** What a shown step says in the chat, and who says it; null: nothing.
 *  `say`: the signed line the walk's screen took from a bank, so the chat
 *  says the same one. `line`: the practise answer's line as the walk showed
 *  it (founder 2026-10-20: the lens and the Lounge say the same words);
 *  without it, the plan's first turn. */
export function shownStep(
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown> | null,
  coachText: string | null,
  say: (bank: WalkBankKey) => string = () => WALK_COPY.clearerOffer,
  line: string | null = null,
): { author: WalkAuthor; body: string; extra?: Record<string, unknown> } | null {
  const app = (body: string | null | undefined) => (body && body.trim() ? { author: "app" as const, body } : null);
  // The bubble's first line, as the prototype's chat writes it.
  const titled = (title: string, body: string | null | undefined) => app(body && body.trim() ? `${title}\n${body}` : null);
  // The Take's highest moment names itself first (founder 2026-10-20): as
  // praise, or with its own line when the walk goes on to make it better
  // (founder 2026-10-21).
  const top = moment?.highest ? `${topMomentLine("clearer", moment)}\n` : "";
  const one = [step];
  switch (step.key) {
    case "hello":
      // The walk's hello (N120), in the words it drew.
      return app(line);
    case "coachnote":
      // "Your coach:" over the words, as the lens writes it (founder
      // 2026-10-20: the colon).
      return coachText ? { author: "coach", body: `${COPY.titleCoachLine}\n${coachText}` } : null;
    case "praise":
      if (moment?.praiseReason) return praiseChat(moment, moment.praiseReason);
      return titled(
        `${moment?.highest ? `${COPY.titleMostConfident}\n` : ""}${moment?.praiseTitle ?? COPY.titlePraise}`,
        moment?.praiseWords.join(" "),
      );
    case "helpers":
      return app(COPY.titleEmphasis);
    case "clearer": {
      // The words that arrive, orange in the chat (prototype v31 `.new em`).
      // Words that undermined the speaker open with B10 (N85). No "Clearer
      // version" title (founder 2026-10-21, K): the opener says it.
      const clearer = moment?.clearer;
      const said = clearer?.say
        ? app(top + [...clearerOpening(clearer.reason, () => say("B13")), clearer.say].join("\n"))
        : null;
      return said ? { ...said, extra: { new_words: moment?.clearer?.after ?? null } } : null;
    }
    case "exVideo":
      return exerciseChat(moment);
    case "improved":
      return titled(COPY.titlePraise, line ?? improvedLine(one, 0));
    case "encourage":
      return titled(COPY.titlePractise, line ?? encourageLine(one, 0));
    case "thanks":
      return app(line ?? thanksLine(one, 0));
    case "late":
      // The Lounge says the same words as the lens (B12): a try the server
      // could not hear; a late read posts nothing.
      return step.kind === "unheard" ? app(WALK_COPY.unheard) : null;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  THE WALK IN THE CHAT (founder 2026-10-26, N192: "there should be just the */
/*  ideal text after the take and the feedback walk above it"). The steps    */
/*  stay stored as above, one thread (B1); the chat draws a Take's steps as  */
/*  one "Feedback walk" bubble with the walk's date, and its Ideal Text card */
/*  under it. Pure.                                                          */
/* -------------------------------------------------------------------------- */

/** The walk steps the chat still draws itself (B3): the Take's Ideal Text
 *  card (the review's end) and the coach's "Later · from your coach"
 *  bubble, a new message (D5). Every other step is in the Feedback walk. */
export function chatDrawsStep(m: LoungeMessage): boolean {
  const meta = m.metadata ?? {};
  return m.kind !== "walk_step" || meta.step === "end" || meta.coach_update === true;
}

/** One Take's walk, as the chat draws it. */
export type ChatWalk = {
  /** The Take (its session). */
  take: string;
  arcId: string | null;
  takeIndex: number | null;
  /** The step the bubble stands in for: the Take's first step in the chat. */
  at: string;
  /** When the walk ran: its first step's time. */
  date: string;
  /** The Take's newest step that opens a part of the walk (B10): the
   *  bubble opens the whole walk standing on it. Null: none to stand on. */
  newest: LoungeMessage | null;
  /** The walk's own copy of the coach's word, held by this bubble (D5). */
  coachCopies: LoungeMessage[];
  /** Something in it changed after it was said (B13): helper words picked
   *  again, the coach's word changed, the summary a coach's note rewrote. */
  edited: boolean;
};

const takeOf = (m: LoungeMessage) => (typeof m.metadata?.take_session_id === "string" ? m.metadata.take_session_id : null);

/** A step that stands for a part of the walk: the app's or the coach's
 *  bubble on a moment, the coach's word, the helper words. Not Other
 *  speakers (an old judging bubble opens new moments, C8). */
function partStep(m: LoungeMessage): boolean {
  const meta = m.metadata ?? {};
  if (m.role !== "bot" || meta.coach_update === true) return false;
  return typeof meta.moment === "number" || meta.step === "coachnote" || meta.step === "helpers";
}

/** The chat's Feedback walks, in the order the Takes' first steps come
 *  (`messages` in the chat's order). A Take with no step but its card has
 *  none: there is nothing to walk. */
export function chatWalks(messages: readonly LoungeMessage[]): ChatWalk[] {
  const walks = new Map<string, ChatWalk>();
  const picks = new Map<string, Set<string>>();
  const edited = new Set<string>();
  for (const m of messages) {
    const meta = m.metadata ?? {};
    const take = takeOf(m);
    if (!take) continue;
    if (meta.summary === true && meta.coach_update === true && typeof meta.earlier === "string") edited.add(take);
    if (m.kind !== "walk_step") continue;
    if (meta.coach_update === true && meta.edited === true) edited.add(take);
    if (typeof meta.words_of === "string") {
      const key = `${take}|${meta.words_of}`;
      const seen = picks.get(key) ?? new Set<string>();
      seen.add(m.client_id);
      picks.set(key, seen);
      if (seen.size > 1) edited.add(take);
    }
    if (chatDrawsStep(m) || meta.step === "share") continue;
    let walk = walks.get(take);
    if (!walk) {
      walk = {
        take,
        arcId: typeof meta.arc_id === "string" ? meta.arc_id : null,
        takeIndex: typeof meta.take_index === "number" ? meta.take_index : null,
        at: m.client_id,
        date: m.client_created_at,
        newest: null,
        coachCopies: [],
        edited: false,
      };
      walks.set(take, walk);
    }
    if (partStep(m)) walk.newest = m;
    if (meta.step === "coachnote" && meta.author === "coach") walk.coachCopies.push(m);
  }
  return [...walks.values()].map((w) => ({ ...w, edited: edited.has(w.take) }));
}

/** A Take's version bubble ("Your ideal text is ready", or verified): the
 *  project's card for that Take before its review's end card exists. */
function versionOf(m: LoungeMessage, walk: ChatWalk): boolean {
  const meta = m.metadata ?? {};
  const version = typeof meta.version === "string" && meta.version.trim() ? Number(meta.version) : meta.version;
  return (
    m.kind === "ideal_text" &&
    (meta.variant === "ready" || meta.variant === "verified") &&
    walk.arcId !== null &&
    meta.arc_id === walk.arcId &&
    walk.takeIndex !== null &&
    version === walk.takeIndex
  );
}

/** THE PAIR (founder 2026-10-26, N202): each Take's Ideal Text card is drawn
 *  right under its Feedback walk, the same width, as one pair, wherever the
 *  card was written; what was said in between stays under the pair. The
 *  card is the review's end; a walk left before its end (the next Take was
 *  recorded) pairs with its Take's version bubble. While the walk still runs
 *  (`live`: the project whose review waits, its newest walk) its card is held
 *  back: the walk's end brings it (N202, question 1). Pure: the chat's drawn
 *  messages in; out, the card under each walk (keyed by the walk's `at`) and
 *  the cards not drawn (an earlier copy of a Take's card, or the live walk's). */
export function walkPairs(
  messages: readonly LoungeMessage[],
  walks: readonly ChatWalk[],
  live: string | null,
): { cardOf: Map<string, string>; held: Set<string> } {
  const cardOf = new Map<string, string>();
  const held = new Set<string>();
  const liveWalk = live ? [...walks].reverse().find((w) => w.arcId === live) ?? null : null;
  for (const walk of walks) {
    const ends = messages.filter((m) => m.kind === "walk_step" && m.metadata?.step === "end" && takeOf(m) === walk.take);
    const cards = ends.length > 0 ? ends : messages.filter((m) => versionOf(m, walk));
    if (cards.length === 0) continue;
    if (walk === liveWalk && ends.length === 0) {
      cards.forEach((m) => held.add(m.client_id));
      continue;
    }
    cardOf.set(walk.at, cards[cards.length - 1].client_id);
    cards.slice(0, -1).forEach((m) => held.add(m.client_id));
  }
  return { cardOf, held };
}

/** Where a step's door opens the walk: its step (a try's opens its
 *  exercise), its moment, its Take and its paragraph. Null: no step. */
export function doorOf(meta: Record<string, unknown>): WalkStepTarget | null {
  const step = typeof meta.step === "string" ? meta.step : null;
  if (!step) return null;
  return {
    step: exerciseStepOf(step),
    moment: typeof meta.moment === "number" ? meta.moment : null,
    take: typeof meta.take_session_id === "string" ? meta.take_session_id : null,
    part: typeof meta.part_id === "string" ? meta.part_id : null,
  };
}

/** A try ("Practise N") or the answer it got opens its exercise, the whole
 *  thread with every try (walk first, 2026-10-14). */
function exerciseStepOf(step: string): string {
  return step.startsWith("try:") || ["improved", "encourage", "thanks"].includes(step) ? "exVideo" : step;
}

/** Where the chat's Feedback walk, and "Continue review" for it, open the
 *  walk (B10, N192): on the coach's word while it waits (C1); while the
 *  review waits, on the step it waits on; once done, on the walk's newest
 *  part; else on the Take alone, which the page opens live on what waits,
 *  or, once done, on its newest step. Always a door: asked with none, the
 *  page opened only a walk it could see waiting, and a walk paused on its
 *  summary or with no part to stand on showed the Ideal Text in its place
 *  (founder 2026-10-26: "the feedback walk opens the ideal text instead of
 *  the feedback walk!"). */
export function feedbackWalkDoor(walk: ChatWalk, waits: readonly LoungeMessage[], live: string | null): WalkStepTarget {
  const coach = waits.find((m) => m.metadata?.step === "coachnote");
  const at = coach ?? (live !== null && live === walk.arcId ? waits[0] : walk.newest);
  return (at ? doorOf(at.metadata ?? {}) : null) ?? { take: walk.take };
}

/** The chat in the order it is drawn (N202): each Take's card right after
 *  its Feedback walk, the cards held back left out, the rest as written. */
export function inPairs<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  pairs: { cardOf: ReadonlyMap<string, string>; held: ReadonlySet<string> },
): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  const moved = new Set(pairs.cardOf.values());
  const out: T[] = [];
  for (const item of items) {
    const id = idOf(item);
    if (moved.has(id) || pairs.held.has(id)) continue;
    out.push(item);
    const card = byId.get(pairs.cardOf.get(id) ?? "");
    if (card) out.push(card);
  }
  return out;
}

/** Who heard each Take, as one line under its recording (G1, N192): the
 *  sharing choice the speaker gave before it, in its own words ("Only my
 *  community (Invita)"). Keyed by the recording's message. */
export function shareLines(messages: readonly LoungeMessage[]): Map<string, string> {
  const out = new Map<string, string>();
  let asked = false;
  let choice: { line: string; arc: unknown } | null = null;
  for (const m of messages) {
    const meta = m.metadata ?? {};
    if (m.kind === "walk_step" && meta.step === "share") {
      if (m.role === "bot") asked = true;
      else if (asked && m.body.trim()) choice = { line: m.body.trim(), arc: meta.arc_id };
      continue;
    }
    if (m.kind !== "recording_summary") continue;
    const arc = meta.arc_id;
    if (choice && (!choice.arc || !arc || choice.arc === arc)) out.set(m.client_id, choice.line);
    asked = false;
    choice = null;
  }
  return out;
}

/** The Take's summary as the chat holds it, for the walk to show (D4,
 *  N192): its words, and the words before a coach's note rewrote them
 *  (D5). Null: not written yet. */
export function storedSummaryOf(
  messages: readonly LoungeMessage[],
  take: string,
): { text: string; earlier: string | null } | null {
  const m = messages.find((x) => x.metadata?.summary === true && x.metadata?.take_session_id === take && x.body.trim());
  if (!m) return null;
  const meta = m.metadata ?? {};
  const earlier = meta.coach_update === true && typeof meta.earlier === "string" && meta.earlier.trim() ? meta.earlier : null;
  return { text: m.body.trim(), earlier };
}

/** The paragraphs whose helper words were picked more than once in `take`'s
 *  walk: each pick is the speaker's bubble with its paragraph (`words_of`),
 *  so a second one is an edit (B13, N192). */
export function wordsEditedIn(messages: readonly LoungeMessage[], take: string): Set<string> {
  const picks = new Map<string, Set<string>>();
  for (const m of messages) {
    const part = m.metadata?.words_of;
    if (m.kind !== "walk_step" || m.metadata?.take_session_id !== take || typeof part !== "string") continue;
    picks.set(part, (picks.get(part) ?? new Set<string>()).add(m.client_id));
  }
  return new Set([...picks].filter(([, ids]) => ids.size > 1).map(([part]) => part));
}
