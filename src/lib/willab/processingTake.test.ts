import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProcessingTake,
  markProcessingTakeFailed,
  readProcessingTake,
  transitionProcessingTakeToDocument,
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
    expect(readProcessingTake("user-b")?.phase).toBe("analysis");
  });

  it("preserves a failed accepted recording for a later retry", () => {
    writeProcessingTake("user-a", take);
    markProcessingTakeFailed("user-a", "session-a");
    expect(readProcessingTake("user-a")?.status).toBe("failed");
    expect(readProcessingTake("user-a")?.sessionId).toBe("session-a");
  });
});
