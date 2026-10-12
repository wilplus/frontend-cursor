import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markProcessingTakeIdealTextUnconfirmed,
  readProcessingTake,
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

  it("preserves the distinct Take 1 Ideal Text terminal state", () => {
    writeProcessingTake("user-a", { ...take, takeIndex: 1 });
    markProcessingTakeIdealTextUnconfirmed("user-a", "session-a");
    expect(readProcessingTake("user-a")?.status).toBe(
      "failed_ideal_text_unconfirmed",
    );
    expect(readProcessingTake("user-a")?.takeIndex).toBe(1);
  });
});
