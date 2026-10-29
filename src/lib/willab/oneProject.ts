import type { TrainingArc } from "@/services/api/trainings";

/* -------------------------------------------------------------------------- */
/*  One project at a time (founder 2026-10-29, backend N254).                 */
/*                                                                            */
/*  The current project is the one with the newest Take. Starting a new       */
/*  project, or going to another one, first asks; Continue archives the       */
/*  current one (N14: nothing is deleted, Data & consent brings it back).     */
/*  The next Take of the current project never asks (Never 3).               */
/* -------------------------------------------------------------------------- */

/** When the project's newest Take was made, in ms; null = no Take known. */
function newestTakeAt(arc: TrainingArc): number | null {
  const stamps = [arc.lastTakeAt, ...arc.takes.map((t) => t.createdAt)]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => Date.parse(s))
    .filter((n) => Number.isFinite(n));
  return stamps.length > 0 ? Math.max(...stamps) : null;
}

/** The project with the newest Take among `arcs`, leaving out `exceptId`
 *  and any project with a deletion under way; null when none has a Take. */
export function currentProjectOf(
  arcs: readonly TrainingArc[],
  exceptId: string | null = null,
): TrainingArc | null {
  let best: { arc: TrainingArc; at: number } | null = null;
  for (const arc of arcs) {
    if (arc.arcId === exceptId || arc.deletion || arc.archived) continue;
    const at = newestTakeAt(arc);
    if (at !== null && (!best || at > best.at)) best = { arc, at };
  }
  return best?.arc ?? null;
}
