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

import { CHUNK_SHEET_COPY as COPY, ONE_THING_COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import type { RootPhraseSpan } from "@/services/api/partLock";
import type { FeedbackWalkMoment, ReplayFixClip, WalkStepTarget } from "./feedbackWalkModel";
import { shareChoiceOf, ticksOf, type ShareChoiceMeta } from "./nextTakeShare";
import { HELPER_WORDS_MAX, quoteSpan } from "./phraseTokens";
import { isFiller } from "./liveNoteWords";
import { stripRichMarkers } from "./richMarkers";
import type { PraiseReason } from "./praiseReason";
import { bestBubble, clearerOpening, praiseBubble, topMomentLine, withoutRepeats, type WalkBankKey } from "./walkLines";
import type { WalkStep } from "./walkPlan";
import { phrasePieces } from "./walkLines";
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
  /** The AI clip's phrase, bold in the fix's words as the walk draws it. */
  phrase: string | null = null,
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
  // The One thing walk's best and its AI clip's fix carry the moment's own
  // words, as the walk draws them (its prototype's `clip(text)`).
  const words =
    step.key === "clearer"
      ? (moment.clearer?.before ?? null)
      : step.one && moment.said
        ? phrasePieces(moment.said, step.key === "exVideo" ? phrase : null).map((p) => ({ ...p, cut: false }))
        : null;
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

/** The choice in its own words, the line under a Take's recording ("Only
 *  my community (Invita)", "General community", "Only me"). */
export function shareLineText(ticks: readonly string[], communities: readonly string[]): string {
  return ticks
    .map((t) =>
      t === "mine"
        ? `${WALK_COPY.shareMine} (${communities.join(", ")})`
        : t === "general"
          ? WALK_COPY.shareGeneral
          : WALK_COPY.shareOnlyMe,
    )
    .join(", ");
}

/** The line under a Take's recording, stored as the speaker's share
 *  message carrying its choice (backend N309 item 5): posted when a Take
 *  keeps the remembered choice, and, naming its Take, when the line is
 *  changed. */
export function shareLineDraft(
  line: string,
  share: ShareChoiceMeta,
  arcId: string | null = null,
  takeSessionId: string | null = null,
): LoungeMessageDraft {
  return {
    role: "user",
    kind: "walk_step",
    body: line,
    metadata: {
      step: "share",
      author: "speaker",
      arc_id: arcId,
      share,
      ...(takeSessionId ? { take_session_id: takeSessionId } : {}),
    },
  };
}

/** Sharing before the next recording, in the chat (prototype v31, lens
 *  off): "Record Take N", the question as one bubble, and the speaker's
 *  choice, which carries what it shares (`share`) so the next Take can
 *  keep it (backend N309 item 5). */
export function shareChat(
  nextTake: number | null,
  ticks: readonly string[],
  communities: readonly string[],
  arcId: string | null = null,
  share: ShareChoiceMeta | null = null,
): LoungeMessageDraft[] {
  const say = (role: "user" | "bot", body: string): LoungeMessageDraft => ({
    role,
    kind: "walk_step",
    body,
    metadata: { step: "share", author: role === "user" ? "speaker" : "app", arc_id: arcId },
  });
  const choice = shareLineText(ticks, communities);
  return [
    ...(nextTake ? [say("user", `Record Take ${nextTake}`)] : []),
    say("bot", SHARE_QUESTION),
    share ? shareLineDraft(choice, share, arcId) : say("user", choice),
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

/** The machine level of the One thing walk's one judged moment (N309
 *  item 2). Never shown. */
export type OthersLevel = "high" | "middle" | "low";

/** The level the walk of Take `takeIndex` judges (N309 item 2): Take 2 high,
 *  3 middle, 4 low, then round again, so over three Takes the speaker hears
 *  all three and the place never tells the level; none on Take 1, which
 *  judges no one. Pure. */
export function othersLevelFor(takeIndex: number | null | undefined): OthersLevel | null {
  if (takeIndex == null || !Number.isInteger(takeIndex) || takeIndex < 2) return null;
  const levels: readonly OthersLevel[] = ["high", "middle", "low"];
  return levels[(takeIndex - 2) % levels.length];
}

/** The speaker's answer on the one judged moment, as their own reply: the
 *  face and the answer with the app's tick ("👍 Yes ✓"; N309 item 2). */
export function othersOneSaid(answer: string): string | null {
  const said = FACES[answer];
  return said ? WALK_COPY.answerToast(said) : null;
}

/** The One thing walk's judged moment in the chat (N309 item 2): the
 *  intro line with the question under it when shown; once answered, the
 *  speaker's reply and "Got it.". Pure. */
export function othersOneChat(answer: string | null): Omit<WalkThreadEntry, "take" | "arcId">[] {
  const where = { moment: null, attempt: 1 };
  if (!answer) {
    return [{ key: "others", ...where, author: "app", body: ONE_THING_COPY.judgeIntro, extra: { hint: COPY.confidenceQuestion } }];
  }
  const said = othersOneSaid(answer);
  if (!said) return [];
  return [
    { key: "answer:others", ...where, author: "speaker", body: said },
    { key: "others:got", ...where, author: "app", body: ONE_THING_COPY.gotIt },
  ];
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

/** The tip the One thing walk gave in the Take right before Take
 *  `takeIndex` of the project (N309 item 1), as its fix step kept it in the
 *  chat (`fix_tip`); null when that Take kept none. Pure. */
export function lastFixTip(
  messages: readonly LoungeMessage[],
  take: string | null,
  arcId: string | null,
  takeIndex: number | null,
): string | null {
  if (takeIndex == null) return null;
  let found: { index: number; tip: string } | null = null;
  for (const m of messages) {
    const meta = m.metadata ?? {};
    if (m.kind !== "walk_step" || meta.take_session_id === take || typeof meta.fix_tip !== "string" || !meta.fix_tip.trim()) continue;
    if (arcId && meta.arc_id !== arcId) continue;
    const index = typeof meta.take_index === "number" ? meta.take_index : null;
    if (index === null || index >= takeIndex) continue;
    if (!found || index >= found.index) found = { index, tip: meta.fix_tip };
  }
  return found && found.index === takeIndex - 1 ? found.tip : null;
}

/** The One thing walk's fix as `take`'s chat kept it, by the moment's
 *  paragraph: the practice whose AI clip it showed (`ai_voice.practice_id`)
 *  and the tip it said (`fix_tip`). A walk played again reads the clip by
 *  it, or says the tip in words (N373 item 2). Pure. */
export function fixClipsIn(messages: readonly LoungeMessage[], take: string): ReadonlyMap<string, ReplayFixClip> {
  const out = new Map<string, ReplayFixClip>();
  for (const m of messages) {
    const meta = m.metadata ?? {};
    if (m.kind !== "walk_step" || meta.take_session_id !== take || meta.step !== "exVideo" || typeof meta.part_id !== "string") continue;
    const ai = meta.ai_voice && typeof meta.ai_voice === "object" ? (meta.ai_voice as Record<string, unknown>) : null;
    const practiceId = typeof ai?.practice_id === "string" && ai.practice_id ? ai.practice_id : null;
    const tip = typeof meta.fix_tip === "string" && meta.fix_tip.trim() ? meta.fix_tip.trim() : null;
    if (practiceId || tip) out.set(meta.part_id, { practiceId, tip });
  }
  return out;
}

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

/** Hesitations a sentence can open with besides the note's fillers: the
 *  words people start on while they find the sentence. */
const OPENERS = new Set(["okay", "ok", "yeah"]);

/** Openers that are a hesitation only when a pause follows them ("So,",
 *  "Well —", "So um"); run straight into the sentence they are its words
 *  ("Right now", "Well over", "So far", "Like many"). */
const PAUSED_OPENERS = new Set(["so", "well", "like", "right"]);

/** Ends on punctuation ("So,"), or is punctuation alone ("—"). */
const pauses = (word: string | undefined): boolean => word !== undefined && /[^\p{L}\p{N}]$/u.test(word);

/** `words[i]` is a hesitation the sentence opens with. Pure. */
function hesitation(words: readonly string[], i: number): boolean {
  const word = words[i];
  if (word === undefined) return false;
  const bare = word.toLowerCase().replace(/[^a-z]/g, "");
  if (isFiller(word) || OPENERS.has(bare)) return true;
  if (!PAUSED_OPENERS.has(bare)) return false;
  return pauses(word) || (i + 1 < words.length && !/[\p{L}\p{N}]/u.test(words[i + 1])) || hesitation(words, i + 1);
}

/** `sentence` without the hesitations it opens with ("So, um, I think…"
 *  gives "I think…"): the helper words after "Keep mine" (backend N435 item
 *  5). The rest is kept whole ("Right now…", "Well over…" stay as they
 *  are); a sentence of nothing else stays as it is. Pure. */
export function withoutOpeningFillers(sentence: string): string {
  const words = sentence.trim().split(/\s+/);
  let i = 0;
  // A dash or other mark between hesitations goes with them.
  while (i < words.length - 1 && (hesitation(words, i) || (i > 0 && !/[\p{L}\p{N}]/u.test(words[i])))) i += 1;
  return i === 0 ? sentence.trim() : words.slice(i).join(" ");
}

/** The Sniper's helper words (N309 item 3): its stretch's words where the
 *  paragraph says them, as the speaker's bubble says them, within the cap
 *  of eight (the stretch is a whole clip, N323 item 2); else none. The same
 *  words are its tip for "Last time" next Take, "give “{words}” more room"
 *  (N347 item 3). Pure. */
export function sniperWords(paragraphText: string, stretch: string): { text: string; span: RootPhraseSpan } | null {
  const words = stretch.trim();
  const n = words.split(/\s+/).filter(Boolean).length;
  if (n === 0 || n > HELPER_WORDS_MAX) return null;
  const span = quoteSpan(paragraphText, words);
  return span ? { text: helperWordsSaid(stripRichMarkers(span.text)), span } : null;
}

/** The words of a One thing walk's try (N309; the locked prototype
 *  X4gDmGfHH7ivuoRZ9ufiy9 draws the try as the speaker's clip with them):
 *  the clearer version's words after "Try it", their own sentence after
 *  "Keep mine", the moment's own words after the AI clip. The walk's bubble
 *  and the chat's say the same. Null: not the One thing walk (a Take served
 *  before N289 keeps "Practise N", C7), or no words served. Pure. */
export function oneThingTryWords(step: WalkStep, moment: FeedbackWalkMoment<unknown>): string | null {
  if (!step.one) return null;
  const words = step.kind === "words" ? moment.clearer?.say : step.kind === "keep" ? moment.clearer?.said : moment.said;
  return words?.trim() || null;
}

export function answerBody(step: WalkStep, value: string): string | null {
  // The One thing walk's taps are not the speaker's messages, in the walk
  // (N435 item 2) or the chat (backend N452 item 1).
  if (step.one) return null;
  if (value === "skip" && ["helpers", "exVideo", "encourage"].includes(step.key)) return WALK_COPY.skip;
  return null;
}

/** The walk's answer to the speaker's Skip on the One thing walk's fix,
 *  said under their "Skip" before the walk goes on (backend N405): "Okay,
 *  we'll skip this one.". Null for anything else. The walk and the chat say
 *  the same. Pure. */
export function skipReply(step: WalkStep, value: string | null): string | null {
  if (value !== "skip" || !step.one) return null;
  // "late": Skip after a try that could not be checked (backend N440 item 5).
  return ["exVideo", "encourage", "practise", "late"].includes(step.key) ? ONE_THING_COPY.skipped : null;
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
  const lines = withoutRepeats([...praiseBubble(moment, moment.praiseLead ?? moment.praiseWords), ...reason.paragraphs]);
  return { author: "app", body: lines.join("\n") };
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
  // The weakest (N289): its own line, unless the level's says it, then
  // Line A, as the walk draws them.
  const weakest = moment.slot === "weakest";
  const head = top
    ? `${topMomentLine(ex?.video ? "example" : "again", moment)}\n`
    : weakest
      ? `${moment.planLevel ? "" : `${WALK_COPY.weakestOpener}\n`}${WALK_COPY.lineA}\n`
      : "";
  const line = ex?.instruction ?? (top || weakest ? "" : WALK_COPY.lineA);
  if (!ex) return { author: "app", body: `${head}${line}`.trim() };
  return {
    author: ex.byCoach ? "coach" : "app",
    body: `${head}${line}`.trim(),
    ...(ex.video ? { extra: { video: ex.video } } : {}),
  };
}

/** What the One thing walk's steps say in the chat (founder 2026-10-31,
 *  N309), its own words as drawn; undefined for any other step. Pure. */
function oneThingSaid(
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown> | null,
  line: string | null,
): { author: WalkAuthor; body: string; extra?: Record<string, unknown> } | null | undefined {
  const app = (body: string | null | undefined) => (body && body.trim() ? { author: "app" as const, body } : null);
  // Last time, "And now, one thing to improve:" and the helper words, in
  // the words the walk drew.
  if (step.key === "last" || step.key === "one" || step.key === "words") return app(line);
  if (!step.one) return undefined;
  const one = [step];
  switch (step.key) {
    case "praise":
      return moment ? app(bestBubble(moment).join("\n")) : null;
    case "clearer":
      return moment?.clearer?.say ? app(`${ONE_THING_COPY.sayStraight}\n${moment.clearer.say}`) : null;
    case "exVideo": {
      // `line` is what the walk draws (N370, N377): "Say this one like your
      // confident moment:" when their best's clip follows it, then with no
      // AI clip the tip, the exercise's instruction and "Your turn.", its
      // video with it; with a clip on its way, the AI bubble's words should
      // it never come.
      const said = app(line);
      const video = moment?.exercise?.video;
      return said && video ? { ...said, extra: { video } } : said;
    }
    case "improved":
      return app(line ?? improvedLine(one, 0));
    case "encourage":
      return app(line ?? encourageLine(one, 0));
    case "thanks":
      return app(line ?? thanksLine(one, 0));
    case "done":
      return app(ONE_THING_COPY.lessonDone);
    case "practise":
      // "Your words it is." after "Keep mine", above the first try, as the
      // walk draws it (N452 item 1: the walk's own answers stay in the chat).
      return !step.replay && step.kind === "keep" && (step.attempt ?? 1) === 1 ? app(ONE_THING_COPY.keepWords) : null;
    default:
      return undefined;
  }
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
  const oneThing = oneThingSaid(step, moment, line);
  if (oneThing !== undefined) return oneThing;
  switch (step.key) {
    case "hello":
      // The walk's hello (N120), in the words it drew.
      return app(line);
    case "lead":
      // The line between moments, or after the last (N285), as drawn.
      return app(line);
    case "coachnote":
      // "Your coach:" over the words, as the lens writes it (founder
      // 2026-10-20: the colon).
      return coachText ? { author: "coach", body: `${COPY.titleCoachLine}\n${coachText}` } : null;
    case "praise":
      if (moment?.praiseReason) return praiseChat(moment, moment.praiseReason);
      // No praise words, no message, as before; the bubble's lines say
      // nothing twice (founder 2026-10-30).
      return moment?.praiseWords.join(" ").trim() ? app(praiseBubble(moment, moment.praiseWords).join("\n")) : null;
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

/** "Your words it is." after "Keep mine" (N452 item 1): the walk's answer
 *  to the speaker's choice, kept in the chat, but never a part of the walk
 *  nor the step the review waits on. A door on it would stand the walk on
 *  the live recorder; the Clearer version it answers stays the door. */
export function walkAnswerRow(m: LoungeMessage): boolean {
  return m.kind === "walk_step" && m.metadata?.step === "practise";
}

/** A step that stands for a part of the walk: the app's or the coach's
 *  bubble on a moment, the coach's word, the helper words. Not Other
 *  speakers (an old judging bubble opens new moments, C8). */
function partStep(m: LoungeMessage): boolean {
  const meta = m.metadata ?? {};
  if (m.role !== "bot" || meta.coach_update === true || walkAnswerRow(m)) return false;
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

/** One Take's line: what it says and the choice it carries (null for a
 *  line stored before backend N309 item 5). */
export type ShareLineEntry = { line: string; share: ShareChoiceMeta | null };

/** Who heard each Take, as one line under its recording (G1, N192): the
 *  sharing choice the speaker gave or kept before it, in its own words
 *  ("Only my community (Invita)"), or the one they changed it to from the
 *  line, which names its Take (N309 item 5). Keyed by the recording's
 *  message. */
export function shareLineEntries(messages: readonly LoungeMessage[]): Map<string, ShareLineEntry> {
  const out = new Map<string, ShareLineEntry>();
  const changed = new Map<string, ShareLineEntry>();
  const recordingOf = new Map<string, string>();
  let asked = false;
  let choice: (ShareLineEntry & { arc: unknown }) | null = null;
  for (const m of messages) {
    const meta = m.metadata ?? {};
    if (m.kind === "walk_step" && meta.step === "share") {
      const line = m.body.trim();
      const share = shareChoiceOf(meta);
      if (m.role === "bot") asked = true;
      else if (line && typeof meta.take_session_id === "string") changed.set(meta.take_session_id, { line, share });
      else if (line && (asked || share)) choice = { line, share, arc: meta.arc_id };
      continue;
    }
    if (m.kind !== "recording_summary") continue;
    if (typeof meta.session_id === "string") recordingOf.set(meta.session_id, m.client_id);
    const arc = meta.arc_id;
    if (choice && (!choice.arc || !arc || choice.arc === arc)) out.set(m.client_id, { line: choice.line, share: choice.share });
    asked = false;
    choice = null;
  }
  for (const [take, entry] of changed) {
    const recording = recordingOf.get(take);
    if (recording) out.set(recording, entry);
  }
  return out;
}

/** The lines alone, keyed by the recording's message. */
export function shareLines(messages: readonly LoungeMessage[]): Map<string, string> {
  return new Map([...shareLineEntries(messages)].map(([id, entry]) => [id, entry.line]));
}

/** The speaker's latest Take, when its recording has a line: the one line
 *  that opens the sharing screen to change it, ticked as it stands (N309
 *  item 5). `communityIds` null: a line stored without its choice, whose
 *  communities the screen ticks as it always did, all of them. */
export type ShareLineChange = {
  recording: string;
  takeSessionId: string;
  arcId: string | null;
  takeIndex: number | null;
  ticks: string[];
  communityIds: string[] | null;
};

/** The ticks a line stored without its choice says, from its own words. */
function ticksOfLine(line: string): string[] {
  if (line === WALK_COPY.shareOnlyMe) return ["none"];
  return [
    ...(line.includes(WALK_COPY.shareGeneral) ? ["general"] : []),
    ...(line.includes(WALK_COPY.shareMine) ? ["mine"] : []),
  ];
}

export function latestShareLine(messages: readonly LoungeMessage[]): ShareLineChange | null {
  const latest = [...messages].reverse().find((m) => m.kind === "recording_summary");
  const meta = latest?.metadata ?? {};
  if (!latest || typeof meta.session_id !== "string") return null;
  const entry = shareLineEntries(messages).get(latest.client_id);
  if (!entry) return null;
  return {
    recording: latest.client_id,
    takeSessionId: meta.session_id,
    arcId: typeof meta.arc_id === "string" ? meta.arc_id : null,
    takeIndex: typeof meta.take_index === "number" ? meta.take_index : null,
    ticks: entry.share ? ticksOf(entry.share) : ticksOfLine(entry.line),
    communityIds: entry.share ? entry.share.community_ids : null,
  };
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
