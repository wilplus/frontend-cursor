/* The walk reads a coach document here. A missing document, or one this
   check refuses, is the walk the app already builds. */

import { buildWalkPlan, type WalkPlanInput, type WalkStep } from "@/lib/willab/walkPlan";
import { SCREENS, type CoachDefinition } from "./types";
import { speakingCoachSeed } from "./seed";

const DIGIT = /\d/;

export function refuse(def: CoachDefinition): string | null {
  if (def.schema !== 1 || def.id !== "speaking-coach") return "COACH_UNKNOWN";
  if (def.shell.recordingClockSeconds !== 300) return "COACH_CLOCK";
  if (def.shell.publicLink !== "hardcoded_will") return "COACH_PUBLIC_LINK";
  if (def.shell.surfaces.length !== 2 || def.shell.surfaces[0] !== "feedback_walk" || def.shell.surfaces[1] !== "ideal_text") {
    return "COACH_SURFACES";
  }
  if (def.will.recording || def.will.composer !== "text") return "COACH_WILL";
  if (def.theme.canvasMaxPx !== 1080) return "COACH_CANVAS";
  const seed = speakingCoachSeed();
  for (const pin of seed.noticing.pinned) {
    const got = def.noticing.pinned.find((row) => row.name === pin.name);
    if (!got || got.value !== pin.value) return "COACH_PINNED";
  }
  for (const row of def.walk.steps) {
    if (!SCREENS.includes(row.screen)) return "COACH_UNKNOWN_SCREEN";
    if (row.key === "tempo" && row.voice) return "COACH_SNIPER_VOICE";
    const sentences = [row.fixed, ...(row.lines ?? []), ...(row.variants ?? []).map((v) => v.fixed), ...(row.choices ?? [])];
    if (sentences.some((line) => line && DIGIT.test(line))) return "COACH_NUMBER";
  }
  for (const plugin of def.plugins) {
    if (!["REWRITE", "EMPHASISE", "ADD", "NOTICE"].includes(plugin.interventionType)) return "COACH_PLUGIN_TYPE";
  }
  return null;
}

function shape(def: CoachDefinition): string {
  return JSON.stringify(def.walk.steps.map((s) => [s.key, s.when]));
}

function applyEdits(plan: WalkStep[], def: CoachDefinition): WalkStep[] {
  const listed = new Set(def.walk.steps.map((s) => s.key));
  const allowed = new Set(def.walk.steps.filter((s) => s.when !== "never").map((s) => s.key));
  const filtered = plan.filter((step) => !listed.has(step.key) || allowed.has(step.key));
  const rank = new Map(def.walk.steps.map((s, i) => [s.key, i]));
  const pinned = (key: string) => (key === "page" ? -1 : key === "end" ? 10_000 : (rank.get(key) ?? 500));
  return [...filtered].sort((a, b) => pinned(a.key) - pinned(b.key));
}

/** The plan for a definition. `{ refused }` leaves the stored seed alone. */
export function planFromDefinition(def: CoachDefinition, input: WalkPlanInput): WalkStep[] | { refused: string } {
  const reason = refuse(def);
  if (reason) return { refused: reason };
  const base = buildWalkPlan(input);
  if (shape(def) === shape(speakingCoachSeed())) return base;
  return applyEdits(base, def);
}

/** What the walk calls. Null, or a refused document, is today's plan. */
export function planForWalk(def: CoachDefinition | null | undefined, input: WalkPlanInput): WalkStep[] {
  if (!def) return buildWalkPlan(input);
  const planned = planFromDefinition(def, input);
  if ("refused" in planned) return buildWalkPlan(input);
  return planned;
}

export function fixedLines(def: CoachDefinition): string[] {
  return def.walk.steps.flatMap((s) => [s.fixed, ...(s.lines ?? []), ...(s.variants ?? []).map((v) => v.fixed), ...(s.choices ?? [])]).filter((line) => line.length > 0);
}
