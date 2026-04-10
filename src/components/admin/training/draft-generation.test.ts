import { describe, expect, it } from "vitest";
import {
  DRAFT_GENERATION_MAX_RETRIES,
  getEffectiveDraftGenerationStatus,
  hasUsableDraftContent,
  shouldHydrateDraftEditor,
  shouldPollDraftGeneration,
} from "./draft-generation";

describe("draft-generation helpers", () => {
  it("treats draft as usable when any plan field exists", () => {
    expect(
      hasUsableDraftContent({
        id: "d1",
        student_id: "u1",
        status: "Draft",
        task_draft: "Task text",
      })
    ).toBe(true);
    expect(
      hasUsableDraftContent({
        id: "d2",
        student_id: "u1",
        status: "Draft",
        ai_script_draft: "Script fallback",
      })
    ).toBe(true);
    expect(
      hasUsableDraftContent({
        id: "d3",
        student_id: "u1",
        status: "Draft",
      })
    ).toBe(false);
  });

  it("supports pending -> ready transition by stopping polling", () => {
    const shouldStartPolling = shouldPollDraftGeneration({
      status: "pending",
      hasUsableDraftContent: false,
      retryCount: 0,
      isEditing: false,
    });
    expect(shouldStartPolling).toBe(true);

    const effectiveAfterRefresh = getEffectiveDraftGenerationStatus({
      status: "ready",
      hasUsableDraftContent: true,
    });
    const shouldContinuePolling = shouldPollDraftGeneration({
      status: effectiveAfterRefresh,
      hasUsableDraftContent: true,
      retryCount: 1,
      isEditing: false,
    });
    expect(shouldContinuePolling).toBe(false);
  });

  it("hides stale pending state when usable draft already exists", () => {
    const effective = getEffectiveDraftGenerationStatus({
      status: "pending",
      hasUsableDraftContent: true,
    });
    expect(effective).toBe("ready");
    expect(
      shouldPollDraftGeneration({
        status: effective,
        hasUsableDraftContent: true,
        retryCount: 0,
        isEditing: false,
      })
    ).toBe(false);
  });

  it("stops polling when retries are exhausted", () => {
    const shouldPoll = shouldPollDraftGeneration({
      status: "pending",
      hasUsableDraftContent: false,
      retryCount: DRAFT_GENERATION_MAX_RETRIES,
      isEditing: false,
    });
    expect(shouldPoll).toBe(false);
  });

  it("returns failed effective status when backend says failed", () => {
    const effective = getEffectiveDraftGenerationStatus({
      status: "failed",
      hasUsableDraftContent: false,
    });
    expect(effective).toBe("failed");
  });

  it("does not poll when status is ready or not_started", () => {
    expect(
      shouldPollDraftGeneration({
        status: "ready",
        hasUsableDraftContent: false,
        retryCount: 0,
        isEditing: false,
      })
    ).toBe(false);
    expect(
      shouldPollDraftGeneration({
        status: "not_started",
        hasUsableDraftContent: false,
        retryCount: 0,
        isEditing: false,
      })
    ).toBe(false);
  });

  it("stops polling when user starts editing", () => {
    const shouldPoll = shouldPollDraftGeneration({
      status: "pending",
      hasUsableDraftContent: false,
      retryCount: 0,
      isEditing: true,
    });
    expect(shouldPoll).toBe(false);
  });

  it("preserves unsaved edits across background refetches", () => {
    expect(
      shouldHydrateDraftEditor({
        isBackgroundRefresh: true,
        hasUnsavedEdits: true,
      })
    ).toBe(false);
    expect(
      shouldHydrateDraftEditor({
        isBackgroundRefresh: true,
        hasUnsavedEdits: false,
      })
    ).toBe(true);
  });
});
