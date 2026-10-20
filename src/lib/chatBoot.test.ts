/*
STORY    As a speaker opening the chat, I want my conversation shown before the side lookups (wallet, menu) run, but never waiting forever, so that the chat appears fast.
OUTCOME
  O1  Side lookups wait until the conversation is shown, then run once.
  O2  Off a chat start they run at once, and a cancelled one never runs.
  O3  If the conversation never loads, they still run after 8 seconds.
PROVES   O1 -> holds a read until the thread has painted, then runs it once
         O2 -> runs promptly off a chat boot, and never after a cancel
         O3 -> does not wait forever on a thread that never loads
*/
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
