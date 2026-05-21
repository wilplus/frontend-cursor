/**
 * Pure helpers for the snippet-label binary (Yes / No) flow.
 *
 * The user sees a YES/NO question whose wording depends on the
 * admin's `coach_label` for the snippet — "Do you agree this leans
 * into charisma?" vs "...into stress?". Regardless of how the
 * question is phrased, the backend stores `user_charisma_label`
 * as a SINGLE BOOLEAN whose meaning is fixed: "does the user
 * think this is charisma?". That decoupling means we always need
 * to translate the user's Yes/No back to that canonical bool
 * before the label POST.
 *
 * These helpers are pure (no React, no fetch) so the mapping rule
 * can be locked down by unit tests — the wrong sign here corrupts
 * RLHF training data silently.
 */

export type CoachLabel = "charisma" | "stress";
export type YesNo = "yes" | "no";

/**
 * Map (admin's coach_label, user's Yes/No answer) → canonical
 * `user_charisma_label: boolean`.
 *
 *   coach_label="charisma" + Yes → true  (user agrees: it IS charisma)
 *   coach_label="charisma" + No  → false (user disagrees: NOT charisma)
 *   coach_label="stress"   + Yes → false (it IS stress → NOT charisma)
 *   coach_label="stress"   + No  → true  (NOT stress → likely charisma)
 *
 * Logic compresses to:
 *   askingAboutCharisma ? userSaidYes : !userSaidYes
 */
export function computeLabelBool(
  coachLabel: CoachLabel,
  answer: YesNo
): boolean {
  const askingAboutCharisma = coachLabel === "charisma";
  const userSaidYes = answer === "yes";
  return askingAboutCharisma ? userSaidYes : !userSaidYes;
}

/**
 * Human-readable prompt for the snippet-label bubble + panel. The
 * fallback ("Do you agree with the coach's read?") shouldn't fire
 * in practice — `coach_label` is constrained to "charisma"|"stress"
 * by the bubble's TypeScript type — but guards against any future
 * enum drift on the BE.
 */
export function snippetLabelPrompt(coachLabel: string): string {
  if (coachLabel === "charisma") {
    return "Do you agree this leans into charisma?";
  }
  if (coachLabel === "stress") {
    return "Do you agree this leans into stress?";
  }
  return "Do you agree with the coach's read?";
}
