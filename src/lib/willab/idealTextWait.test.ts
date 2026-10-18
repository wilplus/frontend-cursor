import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDEAL_TEXT_WAIT_MAX_AGE_MS,
  PENDING_ASK_FOR_MS,
  PENDING_ASK_MS,
  PENDING_ASK_SLOW_AFTER_MS,
  PENDING_ASK_SLOW_MS,
  clearIdealTextWait,
  idealTextWaitStart,
  pendingAskDelay,
} from "./idealTextWait";

/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-10-18: leaving the page and coming back must not run the      */
/*  last slice of the bar again, and the pending screen must not ask the      */
/*  server forever. The wait has one clock per project, and the asking is     */
/*  paced from that clock, not from how long the screen has been mounted.     */
/* -------------------------------------------------------------------------- */

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

describe("the wait's clock survives the screen", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a remount reads the same start, so the bar carries on", () => {
    const first = idealTextWaitStart("arc-a", 1_000_000);
    const again = idealTextWaitStart("arc-a", 1_000_000 + 40_000);
    expect(first).toBe(1_000_000);
    expect(again).toBe(1_000_000);
  });

  it("is one clock per project", () => {
    idealTextWaitStart("arc-a", 1_000_000);
    expect(idealTextWaitStart("arc-b", 2_000_000)).toBe(2_000_000);
  });

  it("an old wait is a new wait, and a cleared one too", () => {
    idealTextWaitStart("arc-a", 1_000_000);
    const later = 1_000_000 + IDEAL_TEXT_WAIT_MAX_AGE_MS + 1;
    expect(idealTextWaitStart("arc-a", later)).toBe(later);
    clearIdealTextWait("arc-a");
    expect(idealTextWaitStart("arc-a", later + 5)).toBe(later + 5);
  });
});

describe("the asking is paced from the wait's age", () => {
  it("asks every five seconds at first, slower after two minutes, then stops", () => {
    expect(pendingAskDelay(0)).toBe(PENDING_ASK_MS);
    expect(pendingAskDelay(PENDING_ASK_SLOW_AFTER_MS - 1)).toBe(PENDING_ASK_MS);
    expect(pendingAskDelay(PENDING_ASK_SLOW_AFTER_MS)).toBe(PENDING_ASK_SLOW_MS);
    expect(pendingAskDelay(PENDING_ASK_FOR_MS - 1)).toBe(PENDING_ASK_SLOW_MS);
    expect(pendingAskDelay(PENDING_ASK_FOR_MS)).toBeNull();
  });
});
