export type TaskTargetProfile =
  | "The Overwhelmed"
  | "The Stressor"
  | "The Drifter"
  | "The Master";

export const TASK_TARGET_PROFILES: TaskTargetProfile[] = [
  "The Overwhelmed",
  "The Stressor",
  "The Drifter",
  "The Master",
];

export function formatTaskTemplateLabel(task: {
  target_profile?: string | null;
  level?: number | null;
  step_in_level?: number | null;
}): string {
  const profile = task.target_profile?.trim() || "Unlabeled profile";
  const level = typeof task.level === "number" ? task.level : null;
  const step = typeof task.step_in_level === "number" ? task.step_in_level : null;
  if (level == null && step == null) return profile;
  if (level != null && step == null) return `${profile} · L${level}`;
  if (level == null && step != null) return `${profile} · Step ${step}`;
  return `${profile} · L${level} · Step ${step}`;
}

export function isTaskTemplateActive(task: { is_active?: boolean | null }): boolean {
  return task.is_active !== false;
}
