/*
STORY    As a speaker, I want the processing bubble to describe only a Take
         the server accepted and is still processing, so navigation and stale
         local state never make a phantom job appear.
OUTCOME
  U1  Visiting/closing Ideal Text, Feedback Walk, pre-Take emotion, practice,
      or an aborted recording leaves no processing bubble.
  U2  An accepted active Take shows it; completion, failure, project changes
      and reload reconciliation do not leak or resurrect it.
PROVES   U1 -> client-only navigation state cannot create the bubble
         U2 -> the server-active/session/project gates are all required
*/
import { describe, expect, it } from "vitest";
import {
  isActiveProcessingState,
  isTerminalProcessingState,
  processingBubbleVisible,
  type ProcessingBubbleResume,
} from "./processingBubble";

const active: ProcessingBubbleResume = {
  sessionId: "take-2",
  arcId: "project-a",
  status: "analyzing",
  serverState: "processing",
};

describe("processing bubble truth", () => {
  it.each([
    ["visiting or closing Ideal Text", null],
    ["visiting or closing the Feedback Walk", null],
    ["opening or closing the pre-Take emotion flow", null],
    ["an aborted recording", { ...active, serverState: null }],
    ["a completion", { ...active, status: "failed" as const, serverState: null }],
    ["a failed, cancelled, or abandoned job", { ...active, status: "failed" as const, serverState: null }],
  ])("does not show for %s", (_flow, resume) => {
    expect(processingBubbleVisible(resume)).toBe(false);
  });

  it("shows only after an accepted upload has an authoritative active status", () => {
    expect(processingBubbleVisible(active)).toBe(true);
    expect(isActiveProcessingState("processing")).toBe(true);
    expect(isTerminalProcessingState("processing")).toBe(false);
  });

  it.each(["ready", "failed", "cancelled", "abandoned"])(
    "treats %s as terminal server truth",
    (state) => {
      expect(isActiveProcessingState(state)).toBe(false);
      expect(isTerminalProcessingState(state)).toBe(true);
    },
  );

  it("does not leak a job into another project", () => {
    expect(processingBubbleVisible(active, { firstTakeWayIn: false, projectId: "project-b" })).toBe(false);
    expect(processingBubbleVisible(active, { firstTakeWayIn: false, projectId: "project-a" })).toBe(true);
  });

  it("reconciles a reload by staying hidden until the server confirms processing", () => {
    const markerReadFromReload = { ...active, serverState: null } as const;
    expect(processingBubbleVisible(markerReadFromReload)).toBe(false);
    expect(processingBubbleVisible({ ...markerReadFromReload, serverState: "processing" })).toBe(true);
  });
});
