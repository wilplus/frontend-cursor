import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearExploreArc,
  exploreArcStorageKey,
  readExploreArc,
  writeExploreArc,
} from "./exploreArc";

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

describe("explore arc account isolation", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never exposes one account's active project to another", () => {
    writeExploreArc("user-a", "arc-a", 2);
    expect(readExploreArc("user-a")?.arcId).toBe("arc-a");
    expect(readExploreArc("user-b")).toBeNull();
  });

  it("keeps the guest lane separate from signed-in accounts", () => {
    writeExploreArc(null, "guest-arc", 2);
    writeExploreArc("user-a", "account-arc", 4);
    expect(readExploreArc(null)?.arcId).toBe("guest-arc");
    expect(readExploreArc("user-a")?.arcId).toBe("account-arc");
  });

  it("clears only the selected account and drops the old global slot", () => {
    writeExploreArc("user-a", "arc-a", 2);
    writeExploreArc("user-b", "arc-b", 3);
    localStorage.setItem("willab_explore_arc", "stale-global-value");

    clearExploreArc("user-a");

    expect(readExploreArc("user-a")).toBeNull();
    expect(readExploreArc("user-b")?.arcId).toBe("arc-b");
    expect(localStorage.getItem("willab_explore_arc")).toBeNull();
  });

  it("does not read the legacy unscoped project", () => {
    localStorage.setItem(
      "willab_explore_arc",
      JSON.stringify({ arcId: "old-shared", nextTakeIndex: 9 })
    );
    expect(readExploreArc("user-a")).toBeNull();
    expect(exploreArcStorageKey("user-a")).not.toBe("willab_explore_arc");
  });
});
