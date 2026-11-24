import type { TrainingArc } from "@/services/api/trainings";

/** Which Take of a project to open, and on what (backend N691 item 2). */
export type TakeInProject = {
  sessionId?: string | null;
  takeIndex?: number | null;
  step: "ideal" | "feedback";
};

/** The Take named, else the one at `takeIndex`, else the newest. Pure. */
export function takeInProject(project: TrainingArc, pick: TakeInProject) {
  const takes = [...(project.takes ?? [])].sort((a, b) => (a.takeIndex ?? 0) - (b.takeIndex ?? 0));
  return takes.find((take) => pick.sessionId && take.sessionId === pick.sessionId)
    ?? takes.find((take) => pick.takeIndex != null && take.takeIndex === pick.takeIndex)
    ?? takes.at(-1)
    ?? null;
}
