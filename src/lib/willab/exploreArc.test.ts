/*
STORY    As a speaker on a shared device, I want my open project never shown to another account, so that my work stays private.
OUTCOME
  O1  Another account reads nothing of the project I have open.
PROVES   O1 -> never exposes one account's active project to another
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
});
