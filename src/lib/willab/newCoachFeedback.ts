import { useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/*  NEW COACH FEEDBACK, PER PROJECT (build plan D-FW-19; walk lock 2026-10-06, */
/*  flow 1: "When new feedback from the coach arrives, the Ideal Text bubble   */
/*  gets the orange outline and a 'new' tag").                                 */
/*                                                                            */
/*  One yes/no per project, never a count (AC-9), as the Lounge's history     */
/*  read serves it (`new_coach_feedback`, backend 0439). Machine-only         */
/*  feedback never makes it true. The bubble reads it here; the walk clears   */
/*  it on the server by saying what it showed, and the Lounge reads it again  */
/*  when the text closes.                                                     */
/* -------------------------------------------------------------------------- */

let flags: Readonly<Record<string, boolean>> = {};
const listeners = new Set<() => void>();

/** The served map, `{project id: bool}`. Anything else is no flag at all. */
export function readNewCoachFeedback(raw: unknown): Record<string, boolean> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, boolean> = {};
  for (const [arc, value] of Object.entries(raw as Record<string, unknown>)) {
    out[arc] = value === true;
  }
  return out;
}

/** Replace what is known with a fresh read. */
export function setNewCoachFeedback(next: Record<string, boolean>): void {
  flags = next;
  for (const listener of listeners) listener();
}

export function newCoachFeedbackFor(arcId: string | null): boolean {
  return arcId !== null && flags[arcId] === true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the project has coach feedback the walk has not shown. */
export function useNewCoachFeedback(arcId: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => newCoachFeedbackFor(arcId),
    () => false,
  );
}

/** Tests: forget everything. */
export function forgetNewCoachFeedback(): void {
  setNewCoachFeedback({});
}
