/** The processing bubble is a view of an accepted server job, never a view of
 *  a recording screen's lifecycle. Keeping this predicate pure makes the
 *  navigation and terminal-state promises testable without mounting Lounge. */

export interface ProcessingBubbleResume {
  sessionId: string;
  arcId: string | null;
  status: "analyzing" | "failed";
  serverState: "processing" | null;
}

/** The backend's readout endpoint exposes one active analysis state. Every
 * other explicit state is terminal for the Lounge bubble, including failure,
 * cancellation and abandonment. */
export function isActiveProcessingState(state: string | null): boolean {
  return state === "processing";
}

export function isTerminalProcessingState(state: string | null): boolean {
  return typeof state === "string" && !isActiveProcessingState(state);
}

export function processingBubbleVisible(
  resume: ProcessingBubbleResume | null,
  options: { firstTakeWayIn: boolean; projectId?: string | null } = {
    firstTakeWayIn: false,
  },
): boolean {
  if (!resume || options.firstTakeWayIn) return false;
  if (resume.status !== "analyzing" || !isActiveProcessingState(resume.serverState)) {
    return false;
  }
  return options.projectId === undefined || resume.arcId === options.projectId;
}
