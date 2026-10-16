import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetChatBootForTests,
  afterChatBoot,
  markChatBootSettled,
  markChatBootStarted,
} from "./chatBoot";

/* -------------------------------------------------------------------------- */
/*  What this protects: during a signed-in /chat boot the wallet, the menu's  */
/*  gates and the guest claim wait for the Lounge thread to paint, and never  */
/*  wait on a thread that is not coming (any other page, a gate that holds).  */
/* -------------------------------------------------------------------------- */

describe("afterChatBoot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetChatBootForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds a read until the thread has painted, then runs it once", () => {
    const read = vi.fn();
    markChatBootStarted();
    afterChatBoot(read);
    vi.advanceTimersByTime(1_000);
    expect(read).not.toHaveBeenCalled();
    markChatBootSettled();
    markChatBootSettled();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("runs promptly off a chat boot, and never after a cancel", () => {
    const read = vi.fn();
    afterChatBoot(read);
    vi.advanceTimersByTime(1);
    expect(read).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    markChatBootStarted();
    afterChatBoot(cancelled)();
    markChatBootSettled();
    vi.advanceTimersByTime(10_000);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("does not wait forever on a thread that never loads", () => {
    const read = vi.fn();
    markChatBootStarted();
    afterChatBoot(read);
    vi.advanceTimersByTime(8_000);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
