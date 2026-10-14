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
import type { LoungeMessageDraft } from "@/services/api/loungeMessages";
import type { FeedbackWalkMoment } from "./feedbackWalkModel";
import type { WalkBankKey } from "./walkLines";
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

/** Sharing before the next recording, in the chat (prototype v31, lens
 *  off): "Record Take N", the question, and the speaker's choice. */
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
    say("bot", WALK_COPY.shareBefore),
    say("bot", WALK_COPY.shareTitle),
    say("bot", WALK_COPY.shareAudience),
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

/** The speaker's answer to a step as their own bubble says it (prototype
 *  v31, lens off). Null: posted elsewhere (helper words, a clearer
 *  version's choice), or nothing to say. */
export function answerBody(step: WalkStep, value: string): string | null {
  if (value === "skip" && ["helpers", "exVideo", "encourage"].includes(step.key)) return WALK_COPY.skip;
  if (step.key === "exVideo" && value === "go") return WALK_COPY.exercisePractise;
  if (step.key === "encourage" && value === "again") return COPY.pillPractiseAgain;
  return null;
}

/** The AI bubble a step showed (N71), as the chat stores it: its lines, and
 *  the practice whose clip the chat fetches afresh (a link expires). */
export function aiVoiceChat(ai: { title?: string; lead?: string; line: string; then?: string; practiceId: string }): {
  author: WalkAuthor;
  body: string;
  extra: Record<string, unknown>;
} {
  return {
    author: "app",
    body: [ai.title, ai.lead, ai.line, ai.then].filter(Boolean).join("\n"),
    extra: { ai_voice: { practice_id: ai.practiceId, then: ai.then ?? null } },
  };
}

/** What a shown step says in the chat, and who says it; null: nothing.
 *  `say`: the signed line the walk's screen took from a bank, so the chat
 *  says the same one. */
export function shownStep(
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown> | null,
  coachText: string | null,
  say: (bank: WalkBankKey) => string = () => WALK_COPY.clearerOffer,
): { author: WalkAuthor; body: string; extra?: Record<string, unknown> } | null {
  const app = (body: string | null | undefined) => (body && body.trim() ? { author: "app" as const, body } : null);
  // The bubble's first line, as the prototype's chat writes it.
  const titled = (title: string, body: string | null | undefined) => app(body && body.trim() ? `${title}\n${body}` : null);
  const one = [step];
  switch (step.key) {
    case "coachnote":
      // "Your coach" over the words, as the prototype's chat writes it.
      return coachText ? { author: "coach", body: `${COPY.titleCoach}\n${coachText}` } : null;
    case "praise":
      return titled(moment?.praiseTitle ?? COPY.titlePraise, moment?.praiseWords.join(" "));
    case "helpers":
      return app(COPY.titleEmphasis);
    case "clearer": {
      // The words that arrive, orange in the chat (prototype v31 `.new em`).
      const said = moment?.clearer?.say ? titled(COPY.cardClearerVersion, `${say("B13")}\n${moment.clearer.say}`) : null;
      return said ? { ...said, extra: { new_words: moment?.clearer?.after ?? null } } : null;
    }
    case "exVideo": {
      const ex = moment?.exercise;
      if (!ex) return moment ? titled(COPY.titleExercise, WALK_COPY.lineA) : null;
      // The video's thumb in the bubble (prototype v31 `vthumb`): the
      // exercise's stored link (a library or coach upload's public address).
      return {
        author: ex.byCoach ? "coach" : "app",
        body: `${COPY.titleExercise}\n${ex.instruction ?? WALK_COPY.lineA}`,
        ...(ex.video ? { extra: { video: ex.video } } : {}),
      };
    }
    case "improved":
      return titled(COPY.titlePraise, improvedLine(one, 0));
    case "encourage":
      return titled(COPY.titlePractise, encourageLine(one, 0));
    case "thanks":
      return app(thanksLine(one, 0));
    default:
      return null;
  }
}
