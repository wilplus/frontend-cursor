/* -------------------------------------------------------------------------- */
/*  THE FEEDBACK WALK'S ONE PERSISTED STATE MACHINE                           */
/*                                                                            */
/*  A Take has one walk.  The walk is an append-only event stream in the      */
/*  Lounge (`walk_step`); each event also carries this small snapshot so a    */
/*  reload does not have to guess which parallel rendering branch was used.   */
/*  This module is deliberately independent of React and of the screen copy. */
/* -------------------------------------------------------------------------- */

import type { LoungeMessage } from "@/services/api/loungeMessages";

export const FEEDBACK_WALK_STATE_VERSION = 1;
export const FEEDBACK_WALK_MAX_TRIES = 3;

export type FeedbackWalkStatus =
  | "not_started"
  | "in_progress"
  | "practice_pending"
  | "completed";

export type FeedbackWalkState = {
  version: typeof FEEDBACK_WALK_STATE_VERSION;
  status: FeedbackWalkStatus;
  activeStep: string | null;
  pendingPractice: string | null;
  completedSteps: string[];
  skippedSteps: string[];
  attempts: Record<string, number>;
};

export type FeedbackWalkTransition = {
  action: "shown" | "answered" | "skipped" | "completed";
  key: string;
  moment?: number | null;
  attempt?: number | null;
  value?: string | null;
  replay?: boolean;
};

export type FeedbackWalkEntry = {
  mode: "first" | "resume" | "review";
  scroll: boolean;
  focus: string | null;
};

/** The only routing decision a door is allowed to make from persisted state. */
export function feedbackWalkEntryFor(state: FeedbackWalkState): FeedbackWalkEntry {
  if (state.status === "completed") return { mode: "review", scroll: true, focus: null };
  if (state.status === "practice_pending") return { mode: "resume", scroll: false, focus: state.pendingPractice };
  if (state.status === "in_progress") return { mode: "resume", scroll: false, focus: state.activeStep };
  return { mode: "first", scroll: false, focus: null };
}
const emptyState = (): FeedbackWalkState => ({
  version: FEEDBACK_WALK_STATE_VERSION,
  status: "not_started",
  activeStep: null,
  pendingPractice: null,
  completedSteps: [],
  skippedSteps: [],
  attempts: {},
});

function stepKey(key: string): string {
  if (key.startsWith("answer:")) return key.slice("answer:".length);
  if (key.startsWith("skipped:")) return key.slice("skipped:".length);
  return key;
}

export function feedbackWalkStepId(key: string, moment: number | null | undefined): string {
  return `${stepKey(key)}:${moment ?? "-"}`;
}

const isPracticeStep = (key: string): boolean =>
  ["exVideo", "practise", "processing", "improved", "encourage", "thanks", "late", "tempo"].includes(stepKey(key));

const addUnique = (items: readonly string[], value: string): string[] =>
  items.includes(value) ? [...items] : [...items, value];

/** Apply one user-visible walk event. Pure and idempotent for replayed rows. */
export function reduceFeedbackWalkState(
  previous: FeedbackWalkState,
  event: FeedbackWalkTransition,
): FeedbackWalkState {
  if (event.replay) return previous;

  const key = stepKey(event.key);
  const id = feedbackWalkStepId(key, event.moment);
  const next: FeedbackWalkState = {
    ...previous,
    completedSteps: [...previous.completedSteps],
    skippedSteps: [...previous.skippedSteps],
    attempts: { ...previous.attempts },
  };

  if (event.action === "completed" || key === "end") {
    return {
      ...next,
      status: "completed",
      activeStep: "end:-",
      pendingPractice: null,
      completedSteps: addUnique(next.completedSteps, id),
    };
  }

  next.activeStep = id;
  if (event.action === "shown") {
    next.status = isPracticeStep(key) ? "practice_pending" : "in_progress";
    next.pendingPractice = isPracticeStep(key) ? id : next.pendingPractice;
    return next;
  }

  const skipped = event.action === "skipped" || event.value === "skip" || event.value === "defer";
  if (skipped && isPracticeStep(key)) {
    next.status = "practice_pending";
    next.pendingPractice = id;
    next.skippedSteps = addUnique(next.skippedSteps, id);
    return next;
  }

  if (key === "practise" && event.action === "answered") {
    next.attempts[id] = Math.min(
      FEEDBACK_WALK_MAX_TRIES,
      Math.max(next.attempts[id] ?? 0, event.attempt ?? 0, 1),
    );
  }
  next.completedSteps = addUnique(next.completedSteps, id);
  if (isPracticeStep(key)) next.pendingPractice = null;
  next.status = "in_progress";
  return next;
}

/** Metadata persisted on the same Lounge row as the step event. */
export function feedbackWalkStateMetadata(state: FeedbackWalkState): Record<string, unknown> {
  return {
    walk_state: true,
    walk_state_version: state.version,
    walk_status: state.status,
    walk_active_step: state.activeStep,
    walk_pending_practice: state.pendingPractice,
    walk_completed_steps: [...state.completedSteps],
    walk_skipped_steps: [...state.skippedSteps],
    walk_attempts: { ...state.attempts },
  };
}

function stateFromMetadata(metadata: Record<string, unknown>): FeedbackWalkState | null {
  if (metadata.walk_state !== true || metadata.walk_state_version !== FEEDBACK_WALK_STATE_VERSION) return null;
  const status = metadata.walk_status;
  if (!["not_started", "in_progress", "practice_pending", "completed"].includes(String(status))) return null;
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  const attempts = metadata.walk_attempts;
  return {
    version: FEEDBACK_WALK_STATE_VERSION,
    status: status as FeedbackWalkStatus,
    activeStep: typeof metadata.walk_active_step === "string" ? metadata.walk_active_step : null,
    pendingPractice: typeof metadata.walk_pending_practice === "string" ? metadata.walk_pending_practice : null,
    completedSteps: list(metadata.walk_completed_steps),
    skippedSteps: list(metadata.walk_skipped_steps),
    attempts: attempts && typeof attempts === "object"
      ? Object.fromEntries(Object.entries(attempts).filter(([, value]) => typeof value === "number")) as Record<string, number>
      : {},
  };
}

/** Read the latest explicit snapshot for one Take, with legacy-row fallback. */
export function feedbackWalkStateFromMessages(
  messages: readonly LoungeMessage[],
  take: string | null | undefined,
): FeedbackWalkState {
  const rows = messages.filter((message) => message.kind === "walk_step" && message.metadata?.take_session_id === take);
  let state = emptyState();
  for (const row of rows) {
    const metadata = row.metadata ?? {};
    const snapshot = stateFromMetadata(metadata);
    if (snapshot) {
      state = snapshot;
      continue;
    }
    const key = typeof metadata.step === "string" ? metadata.step : "";
    if (!key) continue;
    const action: FeedbackWalkTransition["action"] =
      key === "end" ? "completed" : key.startsWith("skipped:") ? "skipped" : key.startsWith("answer:") ? "answered" : "shown";
    state = reduceFeedbackWalkState(state, {
      action,
      key,
      moment: typeof metadata.moment === "number" ? metadata.moment : null,
      attempt: typeof metadata.attempt === "number" ? metadata.attempt : null,
      value: action === "skipped" ? "skip" : null,
    });
  }
  return state;
}
