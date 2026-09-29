import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProcessingTake,
  markProcessingTakeFailed,
  markProcessingTakeIdealTextUnconfirmed,
  readProcessingTake,
  transitionProcessingTakeToDocument,
  updateProcessingTakeProgress,
  writeProcessingTake,
} from "./processingTake";

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.rows.set(key, value);
  }
  removeItem(key: string): void {
    this.rows.delete(key);
  }
}

const take = {
  sessionId: "session-a",
  arcId: "arc-a",
  takeIndex: 2,
  startedAt: 123,
};

describe("processing take account isolation", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never exposes account A's pending analysis to account B", () => {
    writeProcessingTake("user-a", take);
    expect(readProcessingTake("user-a")).toMatchObject({
      ...take,
      phase: "analysis",
      status: "processing",
      phaseStartedAt: 123,
    });
    expect(readProcessingTake("user-b")).toBeNull();
  });

  it("clearing one account leaves another account untouched", () => {
    writeProcessingTake("user-a", take);
    writeProcessingTake("user-b", { ...take, sessionId: "session-b" });
    clearProcessingTake("user-a", "session-a");
    expect(readProcessingTake("user-a")).toBeNull();
    expect(readProcessingTake("user-b")?.sessionId).toBe("session-b");
  });

  it("a stale poll cannot clear a newer marker for the same account", () => {
    writeProcessingTake("user-a", { ...take, sessionId: "new-session" });
    clearProcessingTake("user-a", "old-session");
    expect(readProcessingTake("user-a")?.sessionId).toBe("new-session");
  });

  it("guest state is separate from every signed-in account", () => {
    writeProcessingTake(null, take);
    expect(readProcessingTake(null)?.sessionId).toBe("session-a");
    expect(readProcessingTake("user-a")).toBeNull();
  });

  it("transitions only the selected account and session", () => {
    writeProcessingTake("user-a", take);
    writeProcessingTake("user-b", { ...take, sessionId: "session-b" });
    transitionProcessingTakeToDocument("user-a", "session-a");
    expect(readProcessingTake("user-a")?.phase).toBe("document");
    expect(readProcessingTake("user-a")?.progress).toEqual({
      stage: "document_assembly",
      percent: null,
    });
    expect(readProcessingTake("user-b")?.phase).toBe("analysis");
  });

  it("preserves a failed accepted recording for a later retry", () => {
    writeProcessingTake("user-a", take);
    markProcessingTakeFailed("user-a", "session-a");
    expect(readProcessingTake("user-a")?.status).toBe("failed");
    expect(readProcessingTake("user-a")?.sessionId).toBe("session-a");
  });

  it("preserves the distinct Take 1 Ideal Text terminal state", () => {
    writeProcessingTake("user-a", { ...take, takeIndex: 1 });
    markProcessingTakeIdealTextUnconfirmed("user-a", "session-a");
    expect(readProcessingTake("user-a")?.status).toBe(
      "failed_ideal_text_unconfirmed",
    );
    expect(readProcessingTake("user-a")?.takeIndex).toBe(1);
  });

  it("round-trips the latest real progress for a reopened screen", () => {
    writeProcessingTake("user-a", {
      ...take,
      progress: { stage: "transcribing", percent: 37 },
    });
    expect(readProcessingTake("user-a")?.progress).toEqual({
      stage: "transcribing",
      percent: 37,
    });
  });

  it("treats malformed stored progress as absent and clamps valid percentages", () => {
    localStorage.setItem(
      "willab_processing_take:user-a",
      JSON.stringify({
        ...take,
        progress: { stage: "transcribing", percent: "37" },
      }),
    );
    expect(readProcessingTake("user-a")?.progress).toBeNull();

    writeProcessingTake("user-a", {
      ...take,
      progress: { stage: "completed", percent: 140 },
    });
    expect(readProcessingTake("user-a")?.progress?.percent).toBe(100);
  });

  it("never lets a late session overwrite a newer job's progress", () => {
    writeProcessingTake("user-a", {
      ...take,
      sessionId: "new-session",
      progress: { stage: "transcribing", percent: 40 },
    });
    updateProcessingTakeProgress("user-a", "old-session", {
      stage: "completed",
      percent: 100,
    });
    expect(readProcessingTake("user-a")?.progress).toEqual({
      stage: "transcribing",
      percent: 40,
    });
  });

  it("never lets an older envelope move the same job backwards", () => {
    writeProcessingTake("user-a", {
      ...take,
      progress: { stage: "feedback_moments", percent: 60 },
    });
    expect(
      updateProcessingTakeProgress("user-a", "session-a", {
        stage: "transcribing",
        percent: 30,
      }),
    ).toEqual({ stage: "feedback_moments", percent: 60 });
    expect(readProcessingTake("user-a")?.progress).toEqual({
      stage: "feedback_moments",
      percent: 60,
    });
  });

  it("keeps completed progress terminal even when a late 100% stage arrives", () => {
    writeProcessingTake("user-a", {
      ...take,
      progress: { stage: "completed", percent: 100 },
    });
    updateProcessingTakeProgress("user-a", "session-a", {
      stage: "speaking_anchors",
      percent: 100,
    });
    expect(readProcessingTake("user-a")?.progress).toEqual({
      stage: "completed",
      percent: 100,
    });
  });
});
