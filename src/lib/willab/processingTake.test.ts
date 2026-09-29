import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProcessingTake,
  markProcessingTakeFailed,
  markProcessingTakeIdealTextUnconfirmed,
  PROCESSING_MARKER_MAX_AGE_MS,
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

// `startedAt` is NOW, not a literal. A marker still claiming to be processing
// is ignored once it is older than PROCESSING_MARKER_MAX_AGE_MS, and the old
// fixture value of 123 is epoch 1970 — every marker these tests wrote would
// read back as null. The isolation tests below are unchanged in intent; they
// were never about age. Ageing has its own describe block at the bottom.
const take = {
  sessionId: "session-a",
  arcId: "arc-a",
  takeIndex: 2,
  startedAt: Date.now(),
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
      phaseStartedAt: take.startedAt,
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

describe("a marker stops being believed once it is old", () => {
  // FOUNDER 2026-09-29: an email deep link opened on "Building your Ideal
  // Text" and stayed there. A leftover marker made the Lounge think a take
  // was in flight, and IdealTextOverlay returns before its fetch while that
  // is true — so the document was never requested at all.
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  const ago = (ms: number) => Date.now() - ms;

  it("ignores a processing marker older than the cap", () => {
    writeProcessingTake("user-a", {
      ...take,
      startedAt: ago(PROCESSING_MARKER_MAX_AGE_MS + 60_000),
    });
    expect(readProcessingTake("user-a")).toBeNull();
  });

  it("still believes one inside the cap", () => {
    writeProcessingTake("user-a", {
      ...take,
      startedAt: ago(PROCESSING_MARKER_MAX_AGE_MS - 60_000),
    });
    expect(readProcessingTake("user-a")?.sessionId).toBe("session-a");
  });

  it("KEEPS a failed marker however old it is", () => {
    // It is a note the speaker has not acted on yet (W6). Ageing it out would
    // delete the explanation for a take that never arrived.
    writeProcessingTake("user-a", {
      ...take,
      startedAt: ago(PROCESSING_MARKER_MAX_AGE_MS * 50),
      status: "failed",
    });
    expect(readProcessingTake("user-a")?.status).toBe("failed");
  });

  it("KEEPS an old unconfirmed-ideal-text marker too", () => {
    writeProcessingTake("user-a", {
      ...take,
      startedAt: ago(PROCESSING_MARKER_MAX_AGE_MS * 50),
      status: "failed_ideal_text_unconfirmed",
    });
    expect(readProcessingTake("user-a")?.status).toBe(
      "failed_ideal_text_unconfirmed",
    );
  });

  it("ages a document-phase marker too, not only an analysis one", () => {
    // The screenshot was the DOCUMENT phase. Its only release paths are a
    // live probe and a live timer, neither of which runs on a cold load.
    writeProcessingTake("user-a", {
      ...take,
      startedAt: ago(PROCESSING_MARKER_MAX_AGE_MS + 60_000),
      phase: "document",
      phaseStartedAt: Date.now(),
    });
    expect(readProcessingTake("user-a")).toBeNull();
  });

  it("is far looser than the settle caps, so it can never pre-empt them", () => {
    // 2 min document, 8 min analysis. This rule answers a different question:
    // whether the job can be alive at all. If it ever tightened below the
    // settle caps it would start cutting short honest waits.
    expect(PROCESSING_MARKER_MAX_AGE_MS).toBeGreaterThan(480_000);
  });
});
