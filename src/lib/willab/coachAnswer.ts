/* -------------------------------------------------------------------------- */
/*  The coach's answer to one moment, by kind — the pure half (founder lock    */
/*  2026-10-06, the coach panel redrawn, flow steps 6 to 12; Q-B7 A, Q-B13 A). */
/*                                                                            */
/*    an error the coach hears  → an exercise: the served one kept, another   */
/*                                swapped in, or a new one (words + video);   */
/*                                without a video it goes to the speaker      */
/*                                without the library, never stuck            */
/*    "I don't hear an error"   → a note                                      */
/*    praise                    → a praise line, filed in the library unless  */
/*                                Skip or "Share without the library"         */
/*    a clearer version         → the speaker's only, never the library       */
/*                                (Q-B13 A)                                   */
/*    an ambiguity              → a note                                      */
/*                                                                            */
/*  No fetch, no React.                                                       */
/* -------------------------------------------------------------------------- */

import type { MomentKind } from "./coachWalk";
import { COACH_PANEL_COPY as COPY } from "./coachPanelCopy";
import type { CoachExerciseRequest } from "@/services/api/coachExerciseRequest";
import type { CoachExerciseDraft } from "@/services/api/coachExercises";
import type { Diagnosis } from "@/services/api/coachPanel";

/** What the answer becomes. */
export type AnswerHome = "exercise" | "line" | "version" | "note";

export function answerHome(kind: MomentKind, diagnosis: Diagnosis | null): AnswerHome {
  if (kind === "error") return diagnosis?.kind === "no_error" ? "note" : "exercise";
  if (kind === "praise") return "line";
  if (kind === "rewrite") return "version";
  return "note";
}

/** Your instruction, Your praise, Your clearer version, Your note. */
export function wordsTitle(home: AnswerHome): string {
  if (home === "exercise") return COPY.wordsTitle.error;
  if (home === "line") return COPY.wordsTitle.praise;
  if (home === "version") return COPY.wordsTitle.rewrite;
  return COPY.wordsTitle.ambiguity;
}

/** After the video: the kind question for praise and a clearer version,
 *  else straight to Ready for {p} (Q-B13 A: a note goes straight there). */
export function afterVideo(home: AnswerHome): "kind" | "share" {
  return home === "line" || home === "version" ? "kind" : "share";
}

/** The kind question's title and its answers. */
export function kindQuestion(home: AnswerHome, pseudonym: string): { title: string; options: { key: string; label: string }[] } {
  if (home === "line") {
    return { title: COPY.whatDidDoWell(pseudonym), options: Object.entries(COPY.cue).map(([key, label]) => ({ key, label })) };
  }
  return { title: COPY.whatKindOfFix, options: Object.entries(COPY.moves).map(([key, label]) => ({ key, label })) };
}

/** Does "Share with {p}" file the answer in the library too? A praise line
 *  does unless the kind question was skipped; an exercise does with its
 *  video, under an error the library knows (an error just named waits for
 *  the founder's definition, so its answer reaches the speaker alone); a
 *  clearer version and a note never do. */
export function sharesWithLibrary(input: {
  home: AnswerHome; video: boolean; kindSkipped: boolean; named: boolean;
}): boolean {
  if (input.home === "line") return !input.kindSkipped;
  if (input.home === "exercise") return input.video && !input.named;
  return false;
}

/** The line under the message on Ready for {p}, or null. */
export function shareNote(home: AnswerHome, video: boolean, pseudonym: string): string | null {
  return home === "exercise" && !video ? COPY.withoutAVideo(pseudonym) : null;
}

/** Summary's "Your answer", in the prototype's words, or null while the
 *  moment has none. */
export function yourAnswerWords(
  request: Pick<CoachExerciseRequest, "id" | "resolution" | "resolvedExerciseId"> | null,
  servedId: string | null,
  titleOf: (exerciseId: string) => string | null,
): string | null {
  if (!request?.resolution) return null;
  if (request.resolution === "no_safe_match") return COPY.nothingToAdd;
  const id = request.resolvedExerciseId;
  if (!id) return COPY.shared;
  if (id === exerciseIdFor(request.id)) return COPY.sharedInLibrary;
  const title = titleOf(id) ?? id;
  return id === servedId ? COPY.keptExercise(title) : COPY.swappedExercise(title);
}

/** The exercise id the library files a moment's exercise under. */
export function exerciseIdFor(requestId: string): string {
  return `coach-request-${requestId}`;
}

/** A new exercise made for one moment, under the diagnosed error: named by
 *  its instruction's first words (the library needs a name; the prototype
 *  asks for none). */
export function momentExerciseDraft(requestId: string, errorId: string, instruction: string): CoachExerciseDraft {
  const words = instruction.trim().split(/\s+/).filter(Boolean);
  return {
    exerciseId: exerciseIdFor(requestId),
    title: words.slice(0, 6).join(" ").replace(/[.,;:!?]+$/, ""),
    instruction: instruction.trim(),
    introductionCopy: "",
    acousticProblemTags: [errorId],
    mainTarget: errorId,
    matchingCriteria: null,
    explanationVideoUrl: "",
    active: true,
    aiDraftText: null,
    aiDraftModelVersion: null,
  };
}

/** A slug for a new library exercise from its name (mirrors the backend's
 *  EXERCISE_ID_SHAPE: lowercase, digits, underscore, dash, 2 to 63). */
export function slugFor(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 63);
  return /^[a-z]/.test(slug) && slug.length >= 2 ? slug : `exercise-${slug || "new"}`.slice(0, 63);
}
