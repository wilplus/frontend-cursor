/* -------------------------------------------------------------------------- */
/*  The one answer, by kind (founder 2026-09-30, A3 to A6; build plan P2-11).  */
/*                                                                            */
/*  Words, Video, Home are the same three screens for every kind; only the    */
/*  labels and whether the video is the default differ. This is that table,   */
/*  pure, plus what each answer writes. No fetch, no React.                    */
/*                                                                            */
/*    error      → an exercise: instruction + video + a home in the library   */
/*    praise     → a praise line: filed in the catalogue unless kept          */
/*    rewrite    → a clearer version: the speaker's only, never a move        */
/*    ambiguity  → a note: rides the moment only                              */
/* -------------------------------------------------------------------------- */

import type { MomentKind } from "./coachWalk";
import { COACH_WALK_COPY as COPY } from "./coachWalkCopy";

export type AnswerHome = "exercise" | "line" | "version" | "note";

export interface AnswerPlan {
  kind: MomentKind;
  wordsTitle: string;
  /** The draft surface the backend writes for this kind, or null (ambiguity). */
  draftSurface: "exercise_script" | "praise_line" | "clearer_version" | null;
  /** Video is the default (the primary is Record) or optional (the link). */
  videoDefault: boolean;
  home: AnswerHome;
  /** The pattern the Home screen asks for: the error, a cue or the read, a move, none. */
  pattern: "error" | "cue" | "move" | "none";
}

export function answerPlan(kind: MomentKind): AnswerPlan {
  switch (kind) {
    case "error":
      return { kind, wordsTitle: COPY.wordsTitle.error, draftSurface: "exercise_script",
        videoDefault: true, home: "exercise", pattern: "error" };
    case "praise":
      return { kind, wordsTitle: COPY.wordsTitle.praise, draftSurface: "praise_line",
        videoDefault: false, home: "line", pattern: "cue" };
    case "rewrite":
      return { kind, wordsTitle: COPY.wordsTitle.rewrite, draftSurface: "clearer_version",
        videoDefault: false, home: "version", pattern: "move" };
    default:
      return { kind, wordsTitle: COPY.wordsTitle.ambiguity, draftSurface: null,
        videoDefault: false, home: "note", pattern: "none" };
  }
}

/** The screens this answer walks, in order. Home exists for everything but a
 *  note, which rides the moment and has nowhere else to live. */
export function answerSteps(plan: AnswerPlan): ("words" | "video" | "home")[] {
  return plan.home === "note" ? ["words", "video"] : ["words", "video", "home"];
}

export const REWRITE_MOVES = Object.keys(COPY.homeMoves) as (keyof typeof COPY.homeMoves)[];

/** The delivery cues a praise line may be filed under (services/delivery_cues
 *  CUE_KEYS on the backend), with the words the coach reads. */
export const CUE_OPTIONS: { key: string; label: string }[] = [
  { key: "opened_strong", label: "opened strong" },
  { key: "landed_ending", label: "landed the ending" },
  { key: "kept_moving", label: "kept moving" },
  { key: "settled_pitch", label: "settled pitch" },
  { key: "no_hesitation", label: "no hesitation" },
  { key: "full_volume", label: "full volume" },
  { key: "wide_range", label: "wide range" },
];

export interface HomeState {
  name: string;
  mainTarget: string | null;
  alsoTreats: string[];
  /** praise: the cue key or "confident_read"; rewrite: the move key. */
  patternKey: string | null;
  /** praise only: keep the line to this speaker, off the catalogue. */
  keepToSpeaker: boolean;
}

/** What the Home screen starts with: the spotted patterns first. */
export function homeDefaults(plan: AnswerPlan, spotted: { errorId: string }[]): HomeState {
  const first = spotted[0]?.errorId ?? null;
  return {
    name: "",
    mainTarget: plan.pattern === "error" ? first : null,
    alsoTreats: plan.pattern === "error" ? spotted.slice(1).map((s) => s.errorId) : [],
    patternKey: plan.pattern === "cue" ? (first ?? "confident_read")
      : plan.pattern === "move" ? null : null,
    keepToSpeaker: false,
  };
}

/** Why the Home screen cannot go on yet, in one sentence, or null. */
export function homeProblem(plan: AnswerPlan, home: HomeState, hasVideo: boolean,
  libraryWanted: boolean): string | null {
  if (plan.home !== "exercise" || !libraryWanted) return null;
  if (!home.name.trim()) return COPY.homeNeedsName;
  if (!home.mainTarget) return COPY.homeNeedsTarget;
  if (!hasVideo) return COPY.homeNeedsVideo;
  return null;
}

/** The exercise id the library files a moment's exercise under. */
export function exerciseIdFor(requestId: string): string {
  return `coach-request-${requestId}`;
}

/** A slug for a new library exercise from its name (mirrors the backend's
 *  EXERCISE_ID_SHAPE: lowercase, digits, underscore, dash, 2 to 63). */
export function slugFor(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 63);
  return /^[a-z]/.test(slug) && slug.length >= 2 ? slug : `exercise-${slug || "new"}`.slice(0, 63);
}
