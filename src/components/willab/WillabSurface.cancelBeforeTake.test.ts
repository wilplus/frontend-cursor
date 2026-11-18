/*
STORY    As a speaker, I want closing the feelings or setup screen to cancel
         the attempted Take, so the project does not claim it is processing.
OUTCOME  O1 Pre-take screens clear the pending project-recording bridge;
            recording and processing screens do not.
PROVES   O1 -> "closing before a Take starts does not show Processing your recording"
WHY      Founder report, 2026-11-18.
*/
import { describe, expect, it } from "vitest";
import { cancelsPendingProjectRecording } from "./WillabSurface";

describe("closing a project Take before recording", () => {
  it("cancels only while the Take is still in feelings or setup", () => {
    expect(cancelsPendingProjectRecording("lab_feelings")).toBe(true);
    expect(cancelsPendingProjectRecording("lab_session_context")).toBe(true);
    expect(cancelsPendingProjectRecording("lab_prerecord")).toBe(true);
    expect(cancelsPendingProjectRecording("lab_recording")).toBe(false);
    expect(cancelsPendingProjectRecording("lab_processing")).toBe(false);
  });
});
