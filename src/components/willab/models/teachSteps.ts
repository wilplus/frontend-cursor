import type { Recipe, TeachExample, TeachScreen } from "@/services/api/models";
import { JUDGE_ANSWERS, MODELS_WORDS as W, privateExampleNote } from "./modelsCopy";

/* -------------------------------------------------------------------------- */
/*  One teaching step, as the model's recipe card asks it (backend            */
/*  services/model_launchpad.py, teaching_screen; N563 item 2, N570). The    */
/*  queue hands the examples; the model's page hands its recipe; this joins   */
/*  them the way the backend's rules do, so a follow-up question the backend  */
/*  draws (its `screen`) and a first question drawn here look the same.       */
/*                                                                            */
/*  A voice model on Yes · In-between · No is the coach panel's Judge;        */
/*  "pick" shows its list; "words" asks for a spoken answer. The example      */
/*  arrives with the teacher's fields only (TEACHER_FIELDS): nothing of the   */
/*  machine's read is ever here (Never 2).                                    */
/* -------------------------------------------------------------------------- */

export function recipeSteps(recipe: Recipe | null | undefined): TeachScreen["step"][] {
  const steps = (recipe?.steps ?? []).filter((s): s is TeachScreen["step"] => s === "rate" || s === "pick" || s === "words");
  return steps.length ? steps : ["rate"];
}

const isJudgeScale = (scale: readonly string[]) =>
  scale.length === JUDGE_ANSWERS.length && scale.every((s, i) => s === JUDGE_ANSWERS[i]);

function rateScreen(recipe: Recipe): Pick<TeachScreen, "title" | "question" | "answers"> {
  const scale = recipe.scale?.length ? [...recipe.scale] : [...JUDGE_ANSWERS];
  const voice = (recipe.input ?? "voice") === "voice";
  return {
    ...(voice && isJudgeScale(scale) ? { title: W.judge_title } : {}),
    question: recipe.question ?? null,
    answers: voice ? [...scale, W.audio_unclear, W.skip] : [...scale, W.skip],
  };
}

export function teachScreen(model: string, recipe: Recipe | null | undefined, example: TeachExample, step: number): TeachScreen {
  const r = recipe ?? {};
  const steps = recipeSteps(r);
  const kind = steps[Math.min(step, steps.length - 1)];
  const base = {
    model,
    step: kind,
    example,
    source_note: example.private ? privateExampleNote(model) : null,
  };
  if (kind === "rate") return { ...base, ...rateScreen(r) };
  if (kind === "pick") return { ...base, question: r.pick_question || r.question || null, answers: [...(r.options ?? [])] };
  return { ...base, question: W.words_step, answers: [W.record_answer, W.skip] };
}

/** The Judge's faces: a voice rate step on Yes · In-between · No. */
export function isJudge(screen: TeachScreen): boolean {
  return screen.step === "rate" && screen.title === W.judge_title;
}

/** The answers a screen offers, without the two the screen draws as links. */
export function choicesOf(screen: TeachScreen): string[] {
  return screen.answers.filter((a) => a !== W.skip && a !== W.audio_unclear && a !== W.record_answer);
}

/** How far a model is, read from its own line ("62% of the way …"); a model
 *  that passed its final exam is all the way. Null when the line says
 *  neither: no bar is drawn. */
export function percentOf(line: string): number | null {
  const found = /(\d{1,3})%/.exec(line);
  if (found) return Math.min(100, Number(found[1]));
  return /passed its final exam/i.test(line) ? 100 : null;
}
