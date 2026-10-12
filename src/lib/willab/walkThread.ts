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

import { CHUNK_SHEET_COPY as COPY } from "@/components/willab/idealEditCopy";
import type { LoungeMessageDraft } from "@/services/api/loungeMessages";
import type { FeedbackWalkMoment } from "./feedbackWalkModel";
import type { WalkStep } from "./walkPlan";
import { encourageLine, improvedLine, thanksLine } from "./walkPractise";

export type WalkAuthor = "app" | "coach" | "speaker";

export type WalkThreadEntry = {
  take: string;
  arcId: string | null;
  key: string;
  moment: number | null;
  attempt: number | null;
  author: WalkAuthor;
  body: string;
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
      step: e.key,
      moment: e.moment,
      attempt: e.attempt,
      author: e.author,
    },
  };
}

/** What a shown step says in the chat, and who says it; null: nothing. */
export function shownStep(
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown> | null,
  coachText: string | null,
): { author: WalkAuthor; body: string } | null {
  const app = (body: string | null | undefined) => (body && body.trim() ? { author: "app" as const, body } : null);
  const one = [step];
  switch (step.key) {
    case "coachnote":
      return coachText ? { author: "coach", body: coachText } : null;
    case "praise":
      return app(moment?.praiseWords.join(" "));
    case "helpers":
      return app(COPY.titleEmphasis);
    case "clearer":
      return app(moment?.clearer?.say);
    case "exVideo":
      return app(moment?.exercise?.instruction ?? COPY.titleExercise);
    case "practise":
      return app(
        step.kind === "words"
          ? moment?.clearer?.say
          : step.kind === "instruction"
            ? moment?.exercise?.say
            : moment?.paragraphText,
      );
    case "improved":
      return app(improvedLine(one, 0));
    case "encourage":
      return app(encourageLine(one, 0));
    case "thanks":
      return app(thanksLine(one, 0));
    default:
      return null;
  }
}
